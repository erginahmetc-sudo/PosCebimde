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

    // Past Invoices State
    const [showPastInvoices, setShowPastInvoices] = useState(false);
    const [pastInvoices, setPastInvoices] = useState([]);
    const [loadingPastInvoices, setLoadingPastInvoices] = useState(false);
    const [selectedPastInvoice, setSelectedPastInvoice] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

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

    // Fetch Past Invoices
    const fetchPastInvoices = async () => {
        setLoadingPastInvoices(true);
        try {
            const res = await customersAPI.getManualPurchaseInvoices();
            setPastInvoices(res.data || []);
        } catch (error) {
            console.error('Error loading past invoices:', error);
        } finally {
            setLoadingPastInvoices(false);
        }
    };

    const handleOpenPastInvoices = () => {
        setShowPastInvoices(true);
        fetchPastInvoices();
    };

    // Delete past invoice
    const handleDeleteInvoice = async (invoice) => {
        setDeletingId(invoice.id);
        try {
            // 1. Parse items from description to reverse stock
            let invoiceData = null;
            try { invoiceData = JSON.parse(invoice.description); } catch { /* ignore */ }
            const invoiceItems = invoiceData?.items || [];

            // 2. Reverse stock for each item
            for (const item of invoiceItems) {
                if (item.stockCode && item.quantity) {
                    try {
                        const stockRes = await productsAPI.getByStockCode(item.stockCode);
                        if (stockRes.data) {
                            const currentStock = parseFloat(stockRes.data.stock) || 0;
                            const newStock = Math.max(0, currentStock - parseFloat(item.quantity));
                            await productsAPI.updateStock(item.stockCode, { stock: newStock });
                        }
                    } catch (err) {
                        console.error(`Stock reversal error for ${item.stockCode}:`, err);
                    }
                }
            }

            // 3. Restore customer balance + delete record
            await customersAPI.deleteManualPurchaseInvoice({
                id: invoice.id,
                customer_id: invoice.customer_id,
                amount: invoice.amount,
            });

            setPastInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
            setConfirmDeleteId(null);
        } catch (error) {
            console.error('Delete invoice error:', error);
            alert('Fatura silinirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
        } finally {
            setDeletingId(null);
        }
    };

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
                    source: 'manuel',
                    summary: `Alış Faturası - ${invoiceDetails.serialNo || 'Seri No Yok'} - ${items.length} kalem`,
                    supplier: { name: supplier.name, taxOffice: supplier.taxOffice, taxNo: supplier.taxNo, email: supplier.email, phone: supplier.phone, customerCode: supplier.customerCode, customerId: supplier.customerId },
                    invoiceDetails,
                    items: items.map(it => ({ stockCode: it.stockCode, name: it.name, quantity: it.quantity, price: it.price, vatRate: it.vatRate, disc1: it.disc1 || 0, disc2: it.disc2 || 0, disc3: it.disc3 || 0, disc4: it.disc4 || 0 })),
                    note,
                    totals,
                }),
            });

            // Increase stock for each item
            for (const item of items) {
                if (item.stockCode && item.quantity) {
                    try {
                        const stockRes = await productsAPI.getByStockCode(item.stockCode);
                        if (stockRes.data) {
                            const currentStock = parseFloat(stockRes.data.stock) || 0;
                            const newStock = currentStock + parseFloat(item.quantity);
                            await productsAPI.updateStock(item.stockCode, { stock: newStock });
                        }
                    } catch (err) {
                        console.error(`Stock update error for ${item.stockCode}:`, err);
                    }
                }
            }

            alert('Fatura başarıyla kaydedildi, stoklar güncellendi ve bakiyeye işlendi.');
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
                    <button
                        onClick={handleOpenPastInvoices}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-base">history</span>
                        Daha Önce Kesilen Manuel Faturalar
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

            {/* Past Invoices List Modal */}
            {showPastInvoices && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined">history</span>
                                    Daha Önce Kesilen Manuel Faturalar
                                </h2>
                                <p className="text-indigo-200 text-sm mt-0.5">
                                    Toplam {pastInvoices.length} fatura
                                </p>
                            </div>
                            <button onClick={() => { setShowPastInvoices(false); setConfirmDeleteId(null); }} className="text-white/70 hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingPastInvoices ? (
                                <div className="flex items-center justify-center py-16">
                                    <span className="material-symbols-outlined animate-spin text-4xl text-indigo-400">progress_activity</span>
                                </div>
                            ) : pastInvoices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">receipt_long</span>
                                    <p className="text-slate-500 font-medium">Henüz manuel fatura kaydedilmemiş</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {pastInvoices.map((inv) => {
                                        let invData = null;
                                        try { invData = JSON.parse(inv.description); } catch { /* ignore */ }
                                        const serialNo = invData?.invoiceDetails?.serialNo || '-';
                                        const invDate = invData?.invoiceDetails?.date || inv.created_at;
                                        const customerName = inv.customers?.name || invData?.supplier?.name || '-';
                                        const customerCode = inv.customers?.customer_code || invData?.supplier?.customerCode || '';
                                        const itemCount = invData?.items?.length || 0;
                                        const isConfirmingDelete = confirmDeleteId === inv.id;
                                        const isDeleting = deletingId === inv.id;

                                        return (
                                            <div key={inv.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors group">
                                                {/* Icon */}
                                                <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-indigo-600 text-lg">receipt_long</span>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPastInvoice(inv)}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-900 text-sm truncate">{customerName}</span>
                                                        {customerCode && (
                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold font-mono rounded border border-blue-200">{customerCode}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                                                        {serialNo !== '-' && (
                                                            <span className="font-mono font-medium text-slate-600">{serialNo}</span>
                                                        )}
                                                        <span>{new Date(invDate).toLocaleDateString('tr-TR')}</span>
                                                        <span>{itemCount} kalem</span>
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="flex-shrink-0 text-right cursor-pointer" onClick={() => setSelectedPastInvoice(inv)}>
                                                    <div className="font-bold text-slate-800 text-sm">{formatCurrency(inv.amount)} TL</div>
                                                    <div className="text-[10px] text-slate-400">{new Date(inv.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>

                                                {/* Delete */}
                                                <div className="flex-shrink-0 flex items-center gap-1">
                                                    {isConfirmingDelete ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleDeleteInvoice(inv)}
                                                                disabled={isDeleting}
                                                                className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {isDeleting ? <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-xs">delete</span>}
                                                                Sil
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                                            >
                                                                Vazgeç
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteId(inv.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Faturayı Sil"
                                                        >
                                                            <span className="material-symbols-outlined text-base">delete_outline</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex items-center justify-end flex-shrink-0">
                            <button
                                onClick={() => { setShowPastInvoices(false); setConfirmDeleteId(null); }}
                                className="px-6 py-2 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal (same as CustomerDetailPage Alış Faturası) */}
            {selectedPastInvoice && (() => {
                let invoiceData = null;
                try { invoiceData = JSON.parse(selectedPastInvoice.description); } catch { /* not JSON */ }

                const invItems = invoiceData?.items || [];
                const supplierInfo = invoiceData?.supplier || {};
                const invDetails = invoiceData?.invoiceDetails || {};

                const calcLineTotal = (item) => {
                    let p = (item.quantity || 0) * (item.price || 0);
                    if (item.disc1) p -= p * (item.disc1 / 100);
                    if (item.disc2) p -= p * (item.disc2 / 100);
                    if (item.disc3) p -= p * (item.disc3 / 100);
                    if (item.disc4) p -= p * (item.disc4 / 100);
                    return p + p * ((item.vatRate || 0) / 100);
                };

                const subTotal = invItems.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p;
                }, 0);
                const vatTotal = invItems.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p * ((it.vatRate || 0) / 100);
                }, 0);
                const grandTotal = invoiceData?.totals?.grandTotal || (subTotal + vatTotal);
                const customerName = selectedPastInvoice.customers?.name || supplierInfo.name || '-';

                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined">receipt_long</span>
                                        Alış Faturası Detayları
                                        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-medium">Salt Okunur</span>
                                    </h2>
                                    <p className="text-indigo-200 text-sm mt-0.5">
                                        {customerName} • {new Date(selectedPastInvoice.created_at).toLocaleDateString('tr-TR')}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedPastInvoice(null)} className="text-white/70 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {!invoiceData ? (
                                    <div className="space-y-4">
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <p className="text-amber-700 text-sm font-medium flex items-center gap-2">
                                                <span className="material-symbols-outlined text-lg">info</span>
                                                Bu fatura eski formatta kaydedilmiş. Detaylı ürün bilgisi mevcut değil.
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Tutar</p>
                                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(selectedPastInvoice.amount)} TL</p>
                                        </div>
                                    </div>
                                ) : (
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
                                                <div className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between"><span className="text-slate-500">Seri No:</span><span className="font-medium text-slate-800">{invDetails.serialNo || '-'}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Tarih:</span><span className="font-medium text-slate-800">{invDetails.date ? new Date(invDetails.date).toLocaleDateString('tr-TR') : '-'}</span></div>
                                                    {invDetails.dueDate && (
                                                        <div className="flex justify-between"><span className="text-slate-500">Vade:</span><span className="font-medium text-slate-800">{new Date(invDetails.dueDate).toLocaleDateString('tr-TR')}</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products Table */}
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
                                                <h3 className="font-semibold flex items-center gap-2 text-slate-900 text-sm">
                                                    <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                                                    Ürün Kalemleri ({invItems.length})
                                                </h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                            <th className="px-2 py-2 border-b border-slate-200 w-8 text-center">#</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 w-24 text-left">Stok Kodu</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-left">Ürün Adı</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">Miktar</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-20">B. Fiyat</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">KDV%</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-24">Toplam</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {invItems.map((item, index) => (
                                                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-2 py-2 text-xs text-slate-400 text-center">{index + 1}</td>
                                                                <td className="px-2 py-2 text-xs font-mono font-medium text-slate-600">{item.stockCode || '-'}</td>
                                                                <td className="px-2 py-2 text-xs font-semibold text-slate-900">{item.name || '-'}</td>
                                                                <td className="px-2 py-2 text-xs text-center font-medium text-slate-800">{item.quantity}</td>
                                                                <td className="px-2 py-2 text-xs text-right font-medium text-slate-800">{formatCurrency(item.price)}</td>
                                                                <td className="px-2 py-2 text-xs text-center text-slate-600">%{item.vatRate || 0}</td>
                                                                <td className="px-2 py-2 text-xs text-right font-bold text-slate-700">{formatCurrency(calcLineTotal(item))} TL</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {invItems.length === 0 && (
                                                    <div className="p-8 text-center">
                                                        <p className="text-slate-500 text-sm">Ürün kalemi bulunamadı</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note & Totals */}
                                        {(invoiceData.note || invItems.length > 0) && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    {invoiceData.note && (
                                                        <>
                                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fatura Notu</label>
                                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">{invoiceData.note}</div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">Ara Toplam</span>
                                                        <span className="font-semibold text-slate-900">{formatCurrency(subTotal)} TL</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">KDV Toplamı</span>
                                                        <span className="font-semibold text-slate-900">{formatCurrency(vatTotal)} TL</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-300">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Genel Toplam</span>
                                                            <span className="text-xl font-extrabold text-slate-900">{formatCurrency(grandTotal)} TL</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end flex-shrink-0">
                                <button
                                    onClick={() => setSelectedPastInvoice(null)}
                                    className="px-6 py-2.5 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
