/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, customersAPI } from '../services/api';
import CustomerSearchModal from '../components/modals/CustomerSearchModal';
import ProductSearchModal from '../components/modals/ProductSearchModal';

export default function ManualPurchaseInvoicePage() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Invoice State
    const [supplier, setSupplier] = useState({ name: '', taxOffice: '', taxNo: '', email: '', phone: '', customerCode: '', customerId: null });
    const [saving, setSaving] = useState(false);
    const isCustomerSelected = !!supplier.customerCode;
    const [invoiceDetails, setInvoiceDetails] = useState({
        serialNo: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        isEInvoice: false
    });
    const [items, setItems] = useState([]);
    const [note, setNote] = useState('');
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [showProductSearch, setShowProductSearch] = useState(false);

    // Fetch Products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await productsAPI.getAll();
                if (res.data && res.data.products) {
                    setProducts(res.data.products);
                }
            } catch (error) {
                console.error("Error loading products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Add product from modal
    const addProductFromModal = (product) => {
        setItems(prev => [
            ...prev,
            { id: Date.now(), stockCode: product.stockCode, name: product.name, quantity: product.quantity, price: product.price, vatRate: product.vatRate, disc1: 0, disc2: 0, disc3: 0, disc4: 0 }
        ]);
    };

    // Update Item
    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    // Remove Item
    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    // Calculate discounted price
    const calcDiscountedPrice = (item) => {
        let p = item.quantity * item.price;
        if (item.disc1) p -= p * (item.disc1 / 100);
        if (item.disc2) p -= p * (item.disc2 / 100);
        if (item.disc3) p -= p * (item.disc3 / 100);
        if (item.disc4) p -= p * (item.disc4 / 100);
        return p;
    };

    // Calculations
    const totals = useMemo(() => {
        let subTotal = 0;
        let vatTotal = 0;

        items.forEach(item => {
            const discounted = calcDiscountedPrice(item);
            const lineVat = discounted * (item.vatRate / 100);
            subTotal += discounted;
            vatTotal += lineVat;
        });

        return {
            subTotal,
            vatTotal,
            grandTotal: subTotal + vatTotal
        };
    }, [items]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    // Save Invoice
    const handleSaveInvoice = async () => {
        if (!supplier.customerId || items.length === 0) {
            alert('Lütfen cari seçin ve en az bir ürün ekleyin.');
            return;
        }
        setSaving(true);
        try {
            await customersAPI.addPurchaseTransaction({
                customer_id: supplier.customerId,
                amount: totals.grandTotal,
                description: JSON.stringify({
                    summary: `Alış Faturası - ${invoiceDetails.serialNo || 'Seri No Yok'} - ${items.length} kalem`,
                    supplier: { name: supplier.name, taxOffice: supplier.taxOffice, taxNo: supplier.taxNo, email: supplier.email, phone: supplier.phone, customerCode: supplier.customerCode, customerId: supplier.customerId },
                    invoiceDetails,
                    items: items.map(it => ({ stockCode: it.stockCode, name: it.name, quantity: it.quantity, price: it.price, vatRate: it.vatRate, disc1: it.disc1 || 0, disc2: it.disc2 || 0, disc3: it.disc3 || 0, disc4: it.disc4 || 0 })),
                    note,
                    totals,
                }),
            });
            alert('Fatura başarıyla kaydedildi ve bakiyeye alacak olarak işlendi.');
            // Reset form
            setSupplier({ name: '', taxOffice: '', taxNo: '', email: '', phone: '', customerCode: '', customerId: null });
            setInvoiceDetails({ serialNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], isEInvoice: false });
            setItems([]);
            setNote('');
        } catch (error) {
            console.error('Invoice save error:', error);
            alert('Fatura kaydedilirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-full font-sans">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-blue-600 text-3xl">receipt_long</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Alış Faturası</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Yeni Kayıt</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 bg-white" title="Yazdır">
                        <span className="material-symbols-outlined">print</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Cari Bilgiler */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-lg">business</span>
                            <h2 className="font-semibold text-slate-900 dark:text-white">Cari Bilgiler</h2>
                        </div>
                        <button onClick={() => setShowCustomerSearch(true)} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline">
                            <span className="material-symbols-outlined text-sm">person_search</span>
                            Cari Bul
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Ticari Unvan / Ad Soyad</label>
                            <div className={`flex items-center gap-2 w-full rounded-lg py-2 px-3 border ${isCustomerSelected
                                ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-600 animate-pulse-once'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                }`}>
                                {isCustomerSelected && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold font-mono whitespace-nowrap border border-blue-200">
                                        {supplier.customerCode}
                                    </span>
                                )}
                                <input
                                    className="flex-1 bg-transparent border-none p-0 outline-none cursor-default text-slate-900 dark:text-slate-100"
                                    placeholder="← 'Cari Bul' butonundan seçim yapınız..."
                                    type="text"
                                    value={supplier.name}
                                    readOnly
                                />
                                {isCustomerSelected && (
                                    <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Vergi Dairesi & No</label>
                            <div className="flex gap-2">
                                <input className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" placeholder="Daire" type="text" value={supplier.taxOffice} onChange={(e) => setSupplier({ ...supplier, taxOffice: e.target.value })} />
                                <input className="w-1/3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" placeholder="Vergi No" type="text" value={supplier.taxNo} onChange={(e) => setSupplier({ ...supplier, taxNo: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">E-Posta / İletişim</label>
                            <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" placeholder="ornek@firma.com" type="email" value={supplier.email} onChange={(e) => setSupplier({ ...supplier, email: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Telefon</label>
                            <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" placeholder="0 (___) ___ __ __" type="tel" value={supplier.phone} onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* Fatura Bilgileri */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-slate-400 text-lg">description</span>
                        <h2 className="font-semibold text-slate-900 dark:text-white">Fatura Bilgileri</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Fatura Seri/No</label>
                            <input className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 font-mono outline-none" placeholder="ABC20240000001" type="text" value={invoiceDetails.serialNo} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, serialNo: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Fatura Tarihi</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">calendar_today</span>
                                    <input className="w-full pl-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" type="date" value={invoiceDetails.date} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, date: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Vade Tarihi</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">event</span>
                                    <input className="w-full pl-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none" type="date" value={invoiceDetails.dueDate} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, dueDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input className="rounded text-blue-600 focus:ring-blue-600 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600" id="e-belge" type="checkbox" checked={invoiceDetails.isEInvoice} onChange={(e) => setInvoiceDetails({ ...invoiceDetails, isEInvoice: e.target.checked })} />
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400" htmlFor="e-belge">e-Arşiv / e-Fatura olarak işle</label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ürünler */}
            <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h2 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                        Ürünler
                    </h2>
                    <button onClick={() => setShowProductSearch(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                        Listeye Ürün Ekle
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 w-8 text-center">#</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 w-28 text-left">Stok Kodu</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 text-left" style={{ maxWidth: '180px' }}>Ürün Adı</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 text-left w-16">Miktar</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 text-right w-24">B. Fiyat</th>
                                <th className="px-1 py-2.5 border-b border-slate-200 dark:border-slate-800 text-center w-14">İsk.1</th>
                                <th className="px-1 py-2.5 border-b border-slate-200 dark:border-slate-800 text-center w-14">İsk.2</th>
                                <th className="px-1 py-2.5 border-b border-slate-200 dark:border-slate-800 text-center w-14">İsk.3</th>
                                <th className="px-1 py-2.5 border-b border-slate-200 dark:border-slate-800 text-center w-14">İsk.4</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 text-center w-16">KDV%</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 text-right w-28">Toplam</th>
                                <th className="px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {items.map((item, index) => {
                                const lineTotal = calcDiscountedPrice(item) * (1 + item.vatRate / 100);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-2 py-1.5 text-xs text-slate-400 text-center">{index + 1}</td>
                                        <td className="px-2 py-1.5 text-xs font-mono font-medium text-slate-600">{item.stockCode || '-'}</td>
                                        <td className="px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" style={{ maxWidth: '180px' }} title={item.name}>{item.name || '-'}</td>
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
                                        <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-700 dark:text-slate-300">
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
                        <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">inventory_2</span>
                            <p className="text-slate-500 font-medium">Henüz ürün eklenmedi</p>
                            <p className="text-slate-400 text-sm mt-1">"Listeye Ürün Ekle" butonunu kullanarak ürün ekleyin</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h2 className="font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-slate-400 text-lg">notes</span>
                            Fatura Notu
                        </h2>
                        <textarea
                            className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none outline-none text-slate-900 dark:text-slate-100"
                            placeholder="Bu faturaya ait notlarınızı buraya yazabilirsiniz..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        ></textarea>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Ara Toplam</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(totals.subTotal)} TL</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">KDV Toplamı</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(totals.vatTotal)} TL</span>
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-end">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Genel Toplam</span>
                            <div className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">{formatCurrency(totals.grandTotal)} <span className="text-lg font-medium text-slate-400">TL</span></div>
                        </div>
                        <span className="material-symbols-outlined text-blue-600/20 text-5xl">payments</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] -mx-6 -mb-6 mt-6">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                setSupplier({ name: '', taxOffice: '', taxNo: '', email: '', phone: '', customerCode: '', customerId: null });
                                setInvoiceDetails({ serialNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], isEInvoice: false });
                                setItems([]);
                                setNote('');
                            }}
                            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add_circle_outline</span>
                            Yeni Fatura
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/invoices')} className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-semibold hover:text-red-500 transition-colors">
                            İptal
                        </button>
                        <button
                            disabled={!isCustomerSelected || saving}
                            onClick={handleSaveInvoice}
                            className={`px-8 py-2.5 font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 ${isCustomerSelected && !saving
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                }`}
                            title={!isCustomerSelected ? 'Lütfen önce bir cari seçiniz' : ''}
                        >
                            <span className="material-symbols-outlined text-lg">{saving ? 'hourglass_empty' : 'save'}</span>
                            {saving ? 'Kaydediliyor...' : 'Faturayı Kaydet'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Customer Search Modal */}
            {showCustomerSearch && (
                <CustomerSearchModal
                    onClose={() => setShowCustomerSearch(false)}
                    onSelect={(selected) => setSupplier({
                        name: selected.name,
                        taxOffice: selected.taxOffice,
                        taxNo: selected.taxNo,
                        email: selected.email,
                        phone: selected.phone,
                        customerCode: selected.customerCode,
                        customerId: selected.customerId,
                    })}
                />
            )}

            {/* Product Search Modal */}
            {showProductSearch && (
                <ProductSearchModal
                    products={products}
                    onClose={() => setShowProductSearch(false)}
                    onSelect={addProductFromModal}
                />
            )}
        </div>
    );
}
