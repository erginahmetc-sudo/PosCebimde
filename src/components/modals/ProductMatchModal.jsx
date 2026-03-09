/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";

export default function ProductMatchModal({ isOpen, onClose, invoiceLine, products, onSelect, onCreateNew }) {
    if (!isOpen) return null;

    const [filters, setFilters] = useState({
        name: "",
        stockCode: "",
        barcode: ""
    });

    const [filteredProducts, setFilteredProducts] = useState(products);

    useEffect(() => {
        let result = products;

        // Helper for Turkish-aware case-insensitive check
        const contains = (text, search) =>
            (text || "").toLocaleLowerCase('tr-TR').includes((search || "").toLocaleLowerCase('tr-TR'));

        if (filters.name) {
            result = result.filter(p => contains(p.name, filters.name));
        }
        if (filters.stockCode) {
            result = result.filter(p => contains(p.stock_code, filters.stockCode));
        }
        if (filters.barcode) {
            result = result.filter(p => contains(p.barcode, filters.barcode));
        }
        setFilteredProducts(result);
    }, [filters, products]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop with Premium Blur */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-indigo-900/80 to-purple-900/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>

            {/* Modal Container - Square Corners */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-7xl flex flex-col h-[95vh] overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-300">

                {/* Decorative Glows */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

                {/* Header - Premium Dark Style */}
                <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-900 p-6 border-b border-white/10 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
                    </div>

                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <div>
                                <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1 block">ÜRÜN EŞLEŞTİRME</span>
                                <h3 className="text-white font-extrabold text-2xl leading-tight">Stok Kartı Seçimi</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center gap-1 text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        {invoiceLine?.name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-3 rounded-xl bg-white/10 hover:bg-red-500/20 border border-white/20 transition-all duration-200"
                        >
                            <svg className="w-6 h-6 text-white hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Filters Area - Premium Style */}
                <div className="p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Input Group */}
                        {[{ label: 'Ürün Adı', key: 'name', icon: 'M4 6h16M4 12h16m-7 6h7' },
                        { label: 'Stok Kodu', key: 'stockCode', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14' },
                        { label: 'Barkod', key: 'barcode', icon: 'M12 4v16m8-8H4' }].map((field) => (
                            <div key={field.key} className="relative group">
                                <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 block">
                                    {field.label}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={field.icon} /></svg>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-white border-2 border-gray-200 text-gray-800 text-base font-medium rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                                        placeholder={`${field.label} ile ara...`}
                                        value={filters[field.key]}
                                        onChange={(e) => setFilters({ ...filters, [field.key]: e.target.value })}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-200/50 overflow-hidden ring-1 ring-black/5">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-slate-800 to-indigo-900 text-white font-bold text-sm uppercase tracking-wide">
                                <tr>
                                    <th className="px-6 py-5 w-16 text-center">#</th>
                                    <th className="px-6 py-5 text-left w-48">Stok Kodu</th>
                                    <th className="px-6 py-5 text-left">Ürün Adı</th>
                                    <th className="px-6 py-5 text-left w-48">Barkod</th>
                                    <th className="px-6 py-5 text-right w-36">Satış Fiyatı</th>
                                    <th className="px-6 py-5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map((product, index) => (
                                    <tr
                                        key={product.id}
                                        onClick={() => onSelect(product)}
                                        className="hover:bg-indigo-50/50 cursor-pointer transition-all duration-200 group"
                                    >
                                        <td className="px-6 py-5 text-center">
                                            <span className="font-bold text-gray-400 text-base group-hover:text-indigo-500">{index + 1}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="font-mono font-bold text-base bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg">{product.stock_code}</span>
                                        </td>
                                        <td className="px-6 py-5 font-semibold text-gray-800 text-base group-hover:text-gray-900">{product.name}</td>
                                        <td className="px-6 py-5 text-gray-500 text-sm font-mono">{product.barcode || '-'}</td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-bold text-lg text-emerald-700 bg-emerald-100 px-4 py-2 rounded-xl border border-emerald-200">
                                                {product.sale_price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <svg className="w-6 h-6 text-gray-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </td>
                                    </tr>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <h4 className="text-gray-900 font-bold text-lg">Sonuç Bulunamadı</h4>
                                                <p className="text-gray-500 text-base">Aradığınız kriterlere uygun ürün mevcut değil.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Action - Premium Dark Style */}
                <div className="p-6 bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-900 border-t border-white/10 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
                    </div>

                    <div className="relative z-10">
                        <button
                            onClick={onCreateNew}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center gap-3"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            🚀 Bu Ürünü Yeni Olarak Ekle
                        </button>
                        <p className="text-center text-xs text-slate-400 mt-3 font-medium">
                            Seçili fatura satırındaki veriler kullanılarak yeni bir stok kartı oluşturulacaktır.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
