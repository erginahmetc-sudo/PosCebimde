/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react';
import { productsAPI } from '../../services/api';

export default function ManualPurchaseInvoiceModal({ onClose }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Invoice State
    const [supplier, setSupplier] = useState({ name: '', taxOffice: '', taxNo: '', email: '', phone: '' });
    const [invoiceDetails, setInvoiceDetails] = useState({
        serialNo: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        isEInvoice: false
    });
    const [items, setItems] = useState([
        { id: 1, stockCode: '', name: '', quantity: 1, price: 0, vatRate: 20 }
    ]);
    const [note, setNote] = useState('');

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

    // Add Item
    const addItem = () => {
        setItems([
            ...items,
            { id: Date.now(), stockCode: '', name: '', quantity: 1, price: 0, vatRate: 20 }
        ]);
    };

    // Remove Item
    const removeItem = (id) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    // Update Item
    const updateItem = (id, field, value) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };

                // If stock code or name is changed, try to find product and auto-fill
                if (field === 'stockCode' || field === 'name') {
                    const foundProduct = products.find(p =>
                        (field === 'stockCode' && p.stock_code === value) ||
                        (field === 'name' && p.name === value)
                    );
                    if (foundProduct) {
                        updatedItem.stockCode = foundProduct.stock_code;
                        updatedItem.name = foundProduct.name;
                        updatedItem.price = foundProduct.buying_price || 0;
                        updatedItem.vatRate = foundProduct.vat_rate || 20;
                    }
                }
                return updatedItem;
            }
            return item;
        }));
    };

    // Calculations
    const totals = useMemo(() => {
        let subTotal = 0;
        let vatTotal = 0;

        items.forEach(item => {
            const lineTotal = item.quantity * item.price;
            const lineVat = lineTotal * (item.vatRate / 100);
            subTotal += lineTotal;
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

    return (
        <div className={`fixed inset-0 top-16 z-40 overflow-auto bg-slate-50 ${darkMode ? 'dark' : ''}`}>        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col font-sans">

            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/10 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Alış Faturası</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Yeni Kayıt</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button onClick={() => window.print()} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Yazdır">
                            <span className="material-symbols-outlined">print</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors ml-2"
                            title="Kapat"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Cari Bilgiler */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-lg">business</span>
                                <h2 className="font-semibold text-slate-900 dark:text-white">Cari Bilgiler</h2>
                            </div>
                            <button className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline">
                                <span className="material-symbols-outlined text-sm">person_search</span>
                                Cari Bul
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Ticari Unvan / Ad Soyad</label>
                                <input
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                                    placeholder="Tedarikçi firma seçiniz..."
                                    type="text"
                                    value={supplier.name}
                                    onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
                                />
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
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                            Ürünler
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                <span className="material-symbols-outlined text-sm">add</span>
                                Yeni Satır
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-transparent text-slate-700 dark:text-slate-300">
                                <span className="material-symbols-outlined text-sm">file_download</span>
                                Toplu İçe Aktar
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-12 text-left">#</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-40 text-left">Stok Kodu</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-left">Ürün / Hizmet Adı</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right w-24">Miktar</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right w-32">Birim Fiyat</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center w-24">KDV (%)</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right w-36">Toplam (TL)</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-400">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 font-mono text-slate-900 dark:text-slate-100 outline-none"
                                                type="text"
                                                placeholder="Stok Kodu"
                                                value={item.stockCode}
                                                onChange={(e) => updateItem(item.id, 'stockCode', e.target.value)}
                                                list={`stock-codes-${item.id}`} // Using datalist for suggestions
                                            />
                                            <datalist id={`stock-codes-${item.id}`}>
                                                {products.map(p => <option key={p.id} value={p.stock_code}>{p.name}</option>)}
                                            </datalist>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 text-slate-900 dark:text-slate-100 outline-none"
                                                type="text"
                                                placeholder="Ürün Ara..."
                                                value={item.name}
                                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                list={`product-names-${item.id}`}
                                            />
                                            <datalist id={`product-names-${item.id}`}>
                                                {products.map(p => <option key={p.id} value={p.name}>{p.stock_code}</option>)}
                                            </datalist>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 text-right font-medium text-slate-900 dark:text-slate-100 outline-none"
                                                type="number"
                                                min="0"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 text-right font-medium text-slate-900 dark:text-slate-100 outline-none"
                                                type="number"
                                                min="0"
                                                value={item.price}
                                                onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <select
                                                className="bg-transparent border-none p-0 text-sm focus:ring-0 text-center text-slate-900 dark:text-slate-100 outline-none"
                                                value={item.vatRate}
                                                onChange={(e) => updateItem(item.id, 'vatRate', parseFloat(e.target.value))}
                                            >
                                                <option value={20}>20</option>
                                                <option value={10}>10</option>
                                                <option value={1}>1</option>
                                                <option value={0}>0</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                            {formatCurrency((item.quantity * item.price) * (1 + item.vatRate / 100))}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete_outline</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {items.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                Henüz ürün eklenmedi. "Yeni Satır" butonunu kullanarak ürün ekleyin.
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            </main>

            {/* Footer */}
            <footer className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                setSupplier({ name: '', taxOffice: '', taxNo: '', email: '', phone: '' });
                                setInvoiceDetails({ serialNo: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], isEInvoice: false });
                                setItems([{ id: Date.now(), stockCode: '', name: '', quantity: 1, price: 0, vatRate: 20 }]);
                                setNote('');
                            }}
                            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add_circle_outline</span>
                            Yeni Fatura
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-semibold hover:text-red-500 transition-colors">
                            İptal
                        </button>
                        <button className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">save</span>
                            Faturayı Kaydet
                        </button>
                    </div>
                </div>
            </footer>

        </div>
        </div>
    );
}
