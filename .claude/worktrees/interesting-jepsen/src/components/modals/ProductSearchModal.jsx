/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react';

const MAX_VISIBLE = 100;

export default function ProductSearchModal({ products, onClose, onSelect }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showAll, setShowAll] = useState(false);

    const isLoading = !products || products.length === 0;

    const filtered = useMemo(() => {
        if (isLoading) return [];
        const list = !searchTerm.trim() ? products : products.filter(p => {
            const term = searchTerm.toLowerCase();
            if (searchField === 'all') {
                return (
                    (p.name || '').toLowerCase().includes(term) ||
                    (p.stock_code || '').toLowerCase().includes(term) ||
                    (p.barcode || '').toLowerCase().includes(term)
                );
            }
            if (searchField === 'name') return (p.name || '').toLowerCase().includes(term);
            if (searchField === 'stock_code') return (p.stock_code || '').toLowerCase().includes(term);
            if (searchField === 'barcode') return (p.barcode || '').toLowerCase().includes(term);
            return true;
        });
        return showAll ? list : list.slice(0, MAX_VISIBLE);
    }, [products, searchTerm, searchField, isLoading, showAll]);

    const totalFiltered = useMemo(() => {
        if (isLoading) return 0;
        if (!searchTerm.trim()) return products.length;
        return products.filter(p => {
            const term = searchTerm.toLowerCase();
            if (searchField === 'all') {
                return (p.name || '').toLowerCase().includes(term) || (p.stock_code || '').toLowerCase().includes(term) || (p.barcode || '').toLowerCase().includes(term);
            }
            if (searchField === 'name') return (p.name || '').toLowerCase().includes(term);
            if (searchField === 'stock_code') return (p.stock_code || '').toLowerCase().includes(term);
            if (searchField === 'barcode') return (p.barcode || '').toLowerCase().includes(term);
            return true;
        }).length;
    }, [products, searchTerm, searchField, isLoading]);

    const handleProductClick = (product) => {
        setSelectedProduct(product);
        setQuantity(1);
    };

    const handleConfirm = () => {
        if (!selectedProduct || quantity <= 0) return;
        onSelect({
            stockCode: selectedProduct.stock_code,
            name: selectedProduct.name,
            price: selectedProduct.buying_price || 0,
            vatRate: selectedProduct.vat_rate || 20,
            quantity: quantity,
        });
        onClose();
    };

    const handleBack = () => {
        setSelectedProduct(null);
        setQuantity(1);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <span className="material-symbols-outlined text-white text-xl">inventory_2</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">
                                    {selectedProduct ? 'Miktar Belirle' : 'Ürün Seçimi'}
                                </h2>
                                <p className="text-indigo-200 text-xs">
                                    {selectedProduct ? selectedProduct.name : isLoading ? 'Yükleniyor...' : `${products.length} kayıtlı ürün`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                        >
                            <span className="material-symbols-outlined text-white text-xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                {selectedProduct ? (
                    /* Quantity Step */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 w-full max-w-md text-center border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold font-mono border border-indigo-200">
                                    {selectedProduct.stock_code}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{selectedProduct.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Birim Fiyat: <span className="font-semibold text-slate-700">{(selectedProduct.buying_price || 0).toFixed(2)} TL</span>
                                {' · '}
                                KDV: <span className="font-semibold text-slate-700">%{selectedProduct.vat_rate || 20}</span>
                            </p>
                        </div>

                        <div className="w-full max-w-md">
                            <label className="block text-sm font-semibold text-slate-600 mb-3 text-center">Kaç adet eklemek istiyorsunuz?</label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors text-slate-700 font-bold text-xl"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                                    className="w-24 text-center text-3xl font-bold border-2 border-slate-200 rounded-xl py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-slate-900"
                                    autoFocus
                                />
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-12 h-12 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors text-slate-700 font-bold text-xl"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-center text-sm text-slate-400 mt-3">
                                Toplam: <span className="font-bold text-slate-700">{(quantity * (selectedProduct.buying_price || 0) * (1 + (selectedProduct.vat_rate || 20) / 100)).toFixed(2)} TL</span>
                            </p>
                        </div>

                        <div className="flex gap-3 w-full max-w-md mt-2">
                            <button
                                onClick={handleBack}
                                className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                                Geri Dön
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-[2] py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                                Faturaya Ekle
                            </button>
                        </div>
                    </div>
                ) : isLoading ? (
                    /* Loading Screen */
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-white text-3xl">inventory_2</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Ürünler</h3>
                            <p className="text-slate-400 text-sm mt-1">Yükleniyor</p>
                        </div>
                        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-progress"></div>
                        </div>
                    </div>
                ) : (
                    /* Product Search Step */
                    <>
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Ürün ara... (Ad, Stok Kodu, Barkod)"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <select
                                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={searchField}
                                    onChange={(e) => setSearchField(e.target.value)}
                                >
                                    <option value="all">Tümü</option>
                                    <option value="name">Ürün Adı</option>
                                    <option value="stock_code">Stok Kodu</option>
                                    <option value="barcode">Barkod</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-3">search_off</span>
                                    <p className="font-medium">Sonuç bulunamadı</p>
                                    <p className="text-sm mt-1">Farklı bir arama terimi deneyin</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                        <tr className="text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-3 py-2">Stok Kodu</th>
                                            <th className="px-3 py-2">Barkod</th>
                                            <th className="px-3 py-2">Ürün Adı</th>
                                            <th className="px-3 py-2 text-right">Alış Fiy.</th>
                                            <th className="px-3 py-2 text-center">KDV</th>
                                            <th className="px-3 py-2 text-right">Stok</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filtered.map((product) => (
                                            <tr
                                                key={product.id}
                                                onClick={() => handleProductClick(product)}
                                                className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-3 py-1.5 text-xs font-mono font-bold text-slate-600">{product.stock_code || '-'}</td>
                                                <td className="px-3 py-1.5 text-xs font-mono text-slate-400">{product.barcode || '-'}</td>
                                                <td className="px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{product.name}</td>
                                                <td className="px-3 py-1.5 text-xs font-bold text-right text-slate-700">{(product.buying_price || 0).toFixed(2)}</td>
                                                <td className="px-3 py-1.5 text-xs text-center text-slate-500">%{product.vat_rate || 20}</td>
                                                <td className="px-3 py-1.5 text-xs font-medium text-right text-slate-600">{product.stock ?? '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">{filtered.length}</span>{!showAll && totalFiltered > MAX_VISIBLE ? ` / ${totalFiltered}` : ''} sonuç gösteriliyor
                                </p>
                                {totalFiltered > MAX_VISIBLE && (
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                    >
                                        {showAll ? 'Sınırla' : 'Hepsini Göster'}
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                            >
                                Kapat
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
