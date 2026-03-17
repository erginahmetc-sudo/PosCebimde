/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ProductSearchModal from './ProductSearchModal';

export default function PurchaseInvoiceDetailModal({ transaction, customer, products, onClose, onUpdate }) {
    // Parse invoice data from description (JSON) or fallback
    const parseInvoiceData = () => {
        try {
            const parsed = JSON.parse(transaction.description);
            if (parsed && parsed.items) return parsed;
        } catch { /* not JSON, legacy entry */ }
        return null;
    };

    const invoiceData = parseInvoiceData();
    const isLegacy = !invoiceData;

    // State
    const [items, setItems] = useState(
        invoiceData?.items?.map((it, i) => ({ ...it, id: Date.now() + i })) || []
    );
    const [supplierInfo] = useState(invoiceData?.supplier || {});
    const [invoiceDetails, setInvoiceDetails] = useState(
        invoiceData?.invoiceDetails || { serialNo: '', date: '', dueDate: '', isEInvoice: false }
    );
    const [note, setNote] = useState(invoiceData?.note || '');
    const [saving, setSaving] = useState(false);
    const [showProductSearch, setShowProductSearch] = useState(false);

    // Legacy fallback state
    const [legacyAmount, setLegacyAmount] = useState(transaction.total?.toString() || '');
    const [legacyDesc, setLegacyDesc] = useState(transaction.description || '');

    // Item management
    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };
    const addProductFromModal = (product) => {
        setItems(prev => [
            ...prev,
            { id: Date.now(), stockCode: product.stockCode, name: product.name, quantity: product.quantity, price: product.price, vatRate: product.vatRate, disc1: 0, disc2: 0, disc3: 0, disc4: 0 }
        ]);
    };

    // Calculations
    const calcDiscountedPrice = (item) => {
        let p = item.quantity * item.price;
        if (item.disc1) p -= p * (item.disc1 / 100);
        if (item.disc2) p -= p * (item.disc2 / 100);
        if (item.disc3) p -= p * (item.disc3 / 100);
        if (item.disc4) p -= p * (item.disc4 / 100);
        return p;
    };

    const totals = useMemo(() => {
        let subTotal = 0;
        let vatTotal = 0;
        items.forEach(item => {
            const discounted = calcDiscountedPrice(item);
            const lineVat = discounted * (item.vatRate / 100);
            subTotal += discounted;
            vatTotal += lineVat;
        });
        return { subTotal, vatTotal, grandTotal: subTotal + vatTotal };
    }, [items]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    // Save handler
    const handleSave = async () => {
        if (!isLegacy && items.length === 0) {
            alert('En az bir ürün kalemi olmalıdır.');
            return;
        }
        setSaving(true);
        try {
            const oldAmount = transaction.total;
            let newAmount, newDescription;

            if (isLegacy) {
                newAmount = parseFloat(legacyAmount) || 0;
                newDescription = legacyDesc;
            } else {
                newAmount = totals.grandTotal;
                newDescription = JSON.stringify({
                    summary: `Alış Faturası - ${invoiceDetails.serialNo || 'Seri No Yok'} - ${items.length} kalem`,
                    supplier: supplierInfo,
                    invoiceDetails,
                    items: items.map(it => ({ stockCode: it.stockCode, name: it.name, quantity: it.quantity, price: it.price, vatRate: it.vatRate, disc1: it.disc1 || 0, disc2: it.disc2 || 0, disc3: it.disc3 || 0, disc4: it.disc4 || 0 })),
                    note,
                    totals,
                });
            }

            const diff = newAmount - oldAmount;

            // Update customer_payments record
            const { error: updateError } = await supabase
                .from('customer_payments')
                .update({ amount: newAmount, description: newDescription })
                .eq('id', transaction.id);
            if (updateError) throw updateError;

            // Update customer balance
            if (diff !== 0) {
                const { data: cust } = await supabase.from('customers').select('balance').eq('id', customer.id).single();
                const currentBalance = parseFloat(cust?.balance) || 0;
                await supabase.from('customers').update({ balance: currentBalance - diff, last_transaction_date: new Date().toISOString() }).eq('id', customer.id);
            }

            onUpdate();
        } catch (error) {
            console.error(error);
            alert('Hata: ' + (error.message || 'Fatura güncellenemedi'));
        } finally {
            setSaving(false);
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!confirm('Bu alış faturasını silmek istediğinize emin misiniz?\nBakiye güncellenecektir.')) return;
        setSaving(true);
        try {
            const amount = transaction.total;
            const { error: delError } = await supabase.from('customer_payments').delete().eq('id', transaction.id);
            if (delError) throw delError;

            const { data: cust } = await supabase.from('customers').select('balance').eq('id', customer.id).single();
            const currentBalance = parseFloat(cust?.balance) || 0;
            await supabase.from('customers').update({ balance: currentBalance + amount, last_transaction_date: new Date().toISOString() }).eq('id', customer.id);

            onUpdate();
        } catch (error) {
            console.error(error);
            alert('Hata: ' + (error.message || 'Fatura silinemedi'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">receipt_long</span>
                            Alış Faturası Düzenle
                        </h2>
                        <p className="text-indigo-200 text-sm mt-0.5">
                            {customer.name} • {new Date(transaction.created_at).toLocaleDateString('tr-TR')}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {isLegacy ? (
                        /* Legacy Entry (no JSON data) - Simple Edit */
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <p className="text-amber-700 text-sm font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">info</span>
                                    Bu fatura eski formatta kaydedilmiş. Detaylı ürün bilgisi mevcut değil.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Tutarı (TL)</label>
                                <input
                                    type="number"
                                    value={legacyAmount}
                                    onChange={(e) => setLegacyAmount(e.target.value)}
                                    className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    step="0.01" min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                                <input
                                    type="text"
                                    value={legacyDesc}
                                    onChange={(e) => setLegacyDesc(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:border-indigo-500 outline-none text-sm"
                                />
                            </div>
                        </div>
                    ) : (
                        /* Full Invoice Edit */
                        <>
                            {/* Supplier & Invoice Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">business</span>
                                        Tedarikçi Bilgileri
                                    </h3>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-500">Firma:</span><span className="font-medium text-slate-800">{supplierInfo.name || '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Vergi D.:</span><span className="font-medium text-slate-800">{supplierInfo.taxOffice || '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Vergi No:</span><span className="font-medium text-slate-800">{supplierInfo.taxNo || '-'}</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">description</span>
                                        Fatura Bilgileri
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-500 w-20">Seri No:</label>
                                            <input type="text" value={invoiceDetails.serialNo} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, serialNo: e.target.value })} className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-500 w-20">Tarih:</label>
                                            <input type="date" value={invoiceDetails.date} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, date: e.target.value })} className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-500 w-20">Vade:</label>
                                            <input type="date" value={invoiceDetails.dueDate} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, dueDate: e.target.value })} className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Products Table */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-semibold flex items-center gap-2 text-slate-900 text-sm">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                                        Ürün Kalemleri ({items.length})
                                    </h3>
                                    <button onClick={() => setShowProductSearch(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                                        Ürün Ekle
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                <th className="px-2 py-2 border-b border-slate-200 w-8 text-center">#</th>
                                                <th className="px-2 py-2 border-b border-slate-200 w-24 text-left">Stok Kodu</th>
                                                <th className="px-2 py-2 border-b border-slate-200 text-left" style={{ maxWidth: '160px' }}>Ürün Adı</th>
                                                <th className="px-2 py-2 border-b border-slate-200 text-left w-14">Miktar</th>
                                                <th className="px-2 py-2 border-b border-slate-200 text-right w-20">B. Fiyat</th>
                                                <th className="px-1 py-2 border-b border-slate-200 text-center w-12">İsk.1</th>
                                                <th className="px-1 py-2 border-b border-slate-200 text-center w-12">İsk.2</th>
                                                <th className="px-1 py-2 border-b border-slate-200 text-center w-12">İsk.3</th>
                                                <th className="px-1 py-2 border-b border-slate-200 text-center w-12">İsk.4</th>
                                                <th className="px-2 py-2 border-b border-slate-200 text-center w-14">KDV%</th>
                                                <th className="px-2 py-2 border-b border-slate-200 text-right w-24">Toplam</th>
                                                <th className="px-2 py-2 border-b border-slate-200 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {items.map((item, index) => {
                                                const lineTotal = calcDiscountedPrice(item) * (1 + item.vatRate / 100);
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-2 py-1.5 text-xs text-slate-400 text-center">{index + 1}</td>
                                                        <td className="px-2 py-1.5 text-xs font-mono font-medium text-slate-600">{item.stockCode || '-'}</td>
                                                        <td className="px-2 py-1.5 text-xs font-semibold text-slate-900 truncate" style={{ maxWidth: '160px' }} title={item.name}>{item.name || '-'}</td>
                                                        <td className="px-2 py-1.5">
                                                            <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseFloat(e.target.value) || 1))} className="w-full bg-transparent border-none p-0 text-xs text-left font-medium text-slate-900 outline-none focus:ring-0" />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-xs text-right font-medium text-slate-900 outline-none focus:ring-0" />
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <input type="number" min="0" max="100" step="0.1" value={item.disc1 || ''} onChange={(e) => updateItem(item.id, 'disc1', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[11px] text-center text-slate-500 outline-none focus:ring-0" placeholder="%" />
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <input type="number" min="0" max="100" step="0.1" value={item.disc2 || ''} onChange={(e) => updateItem(item.id, 'disc2', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[11px] text-center text-slate-500 outline-none focus:ring-0" placeholder="%" />
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <input type="number" min="0" max="100" step="0.1" value={item.disc3 || ''} onChange={(e) => updateItem(item.id, 'disc3', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[11px] text-center text-slate-500 outline-none focus:ring-0" placeholder="%" />
                                                        </td>
                                                        <td className="px-1 py-1.5">
                                                            <input type="number" min="0" max="100" step="0.1" value={item.disc4 || ''} onChange={(e) => updateItem(item.id, 'disc4', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border-none p-0 text-[11px] text-center text-slate-500 outline-none focus:ring-0" placeholder="%" />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <select value={item.vatRate} onChange={(e) => updateItem(item.id, 'vatRate', parseFloat(e.target.value))} className="w-full bg-transparent border-none p-0 text-xs text-center text-slate-600 outline-none focus:ring-0 cursor-pointer">
                                                                <option value={20}>%20</option>
                                                                <option value={10}>%10</option>
                                                                <option value={1}>%1</option>
                                                                <option value={0}>%0</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-700">
                                                            {formatCurrency(lineTotal)} TL
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                                <span className="material-symbols-outlined text-base">delete_outline</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {items.length === 0 && (
                                        <div className="p-8 text-center">
                                            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">inventory_2</span>
                                            <p className="text-slate-500 text-sm font-medium">Henüz ürün kalemi yok</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Note & Totals */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fatura Notu</label>
                                    <textarea
                                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none outline-none"
                                        placeholder="Fatura notu..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </div>
                                <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Ara Toplam</span>
                                        <span className="font-semibold text-slate-900">{formatCurrency(totals.subTotal)} TL</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">KDV Toplamı</span>
                                        <span className="font-semibold text-slate-900">{formatCurrency(totals.vatTotal)} TL</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-300">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Genel Toplam</span>
                                            <span className="text-xl font-extrabold text-slate-900">{formatCurrency(totals.grandTotal)} TL</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={handleDelete}
                        disabled={saving}
                        className="px-4 py-2.5 text-red-600 bg-red-50 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Faturayı Sil
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-xl font-medium hover:bg-slate-100 transition-colors text-sm"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 text-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
                            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Product Search Modal */}
            {showProductSearch && (
                <ProductSearchModal
                    products={products || []}
                    onClose={() => setShowProductSearch(false)}
                    onSelect={addProductFromModal}
                />
            )}
        </div>
    );
}
