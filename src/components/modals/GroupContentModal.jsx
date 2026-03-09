import { useState, useEffect } from 'react';
import { productsAPI, shortcutsAPI } from '../../services/api';

export default function GroupContentModal({ isOpen, onClose, groupName }) {
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupItems, setGroupItems] = useState([]); // { ...product, orderVal: 1 }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && groupName) {
            loadData();
        }
    }, [isOpen, groupName]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load All Products
            const pRes = await productsAPI.getAll();
            const products = pRes.data?.products || [];
            setAllProducts(products);

            // 2. Load Group Data to get current items
            const sRes = await shortcutsAPI.getAll();
            const shortcuts = sRes.data?.shortcuts || [];
            const currentGroup = shortcuts.find(s => s.name === groupName);

            if (currentGroup && currentGroup.items && Array.isArray(currentGroup.items)) {
                // Map existing items (stock_codes) to product objects
                // Preserving order from DB (which is the saved order)
                const mapped = currentGroup.items.map((code, index) => {
                    const p = products.find(prod => prod.stock_code === code);
                    if (!p) return null;
                    return { ...p, orderVal: index + 1 };
                }).filter(Boolean); // changes: Remove nulls
                setGroupItems(mapped);
            } else {
                setGroupItems([]);
            }

        } catch (error) {
            console.error(error);
            alert("Veriler yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = (product) => {
        if (groupItems.some(item => item.stock_code === product.stock_code)) return; // Already exists

        // Auto increment order
        const maxOrder = groupItems.reduce((max, item) => Math.max(max, parseInt(item.orderVal) || 0), 0);
        setGroupItems([...groupItems, { ...product, orderVal: maxOrder + 1 }]);
    };

    const handleRemoveItem = (stockCode) => {
        setGroupItems(groupItems.filter(item => item.stock_code !== stockCode));
    };

    const handleOrderChange = (index, val) => {
        const newItems = [...groupItems];
        newItems[index].orderVal = val;
        setGroupItems(newItems);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Sort items by orderVal
            const sortedItems = [...groupItems].sort((a, b) => {
                const orderA = parseInt(a.orderVal) || 9999;
                const orderB = parseInt(b.orderVal) || 9999;
                return orderA - orderB;
            });

            // Extract stock codes
            const itemCodes = sortedItems.map(item => item.stock_code);

            await shortcutsAPI.updateCategory(groupName, { items: itemCodes });
            onClose(); // Close and Refetch parent? Parent should refetch.
            alert("Grup güncellendi!");
        } catch (error) {
            console.error(error);
            alert("Kaydetme başarısız.");
        } finally {
            setSaving(false);
        }
    };

    // Filter left list
    const filteredSource = allProducts.filter(p => {
        if (groupItems.some(item => item.stock_code === p.stock_code)) return false; // Hide already added
        const search = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(search) || p.stock_code.toLowerCase().includes(search);
    }).slice(0, 50); // Limit display

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header - Modern Gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Grubu Düzenle: <span className="text-blue-200">{groupName}</span>
                            </h2>
                            <p className="text-blue-200 mt-1">Ürünleri seçin ve sıralama numarası vererek düzenleyin</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-3 rounded-xl transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex min-h-0 bg-gradient-to-br from-gray-50 to-blue-50 p-6 gap-6">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-600 font-medium">Veriler yükleniyor...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* LEFT: Source */}
                            <div className="w-1/3 bg-white border-2 border-gray-200 rounded-2xl flex flex-col shadow-lg overflow-hidden">
                                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                    <h3 className="font-bold text-gray-800 text-base mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                        Ürün Listesi
                                    </h3>
                                    <input
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Ürün ara (isim veya stok kodu)..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {filteredSource.map(p => (
                                        <div
                                            key={p.stock_code}
                                            onClick={() => handleAddItem(p)}
                                            className="p-3 border-2 border-gray-100 rounded-xl hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group flex justify-between items-center"
                                        >
                                            <div className="overflow-hidden">
                                                <div className="text-base font-semibold text-gray-800 truncate">{p.name}</div>
                                                <div className="text-sm text-gray-500 font-mono">{p.stock_code}</div>
                                            </div>
                                            <span className="text-blue-600 opacity-0 group-hover:opacity-100 font-bold text-2xl transition-opacity">+</span>
                                        </div>
                                    ))}
                                    {filteredSource.length === 0 && (
                                        <div className="text-center text-gray-400 py-8">
                                            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p>Ürün bulunamadı</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Selected Items */}
                            <div className="flex-1 bg-white border-2 border-gray-200 rounded-2xl flex flex-col shadow-lg overflow-hidden">
                                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
                                    <h3 className="font-bold text-blue-800 text-base flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Grup İçeriği ({groupItems.length} ürün)
                                    </h3>
                                    <span className="text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg font-semibold">Sıra Numarasına Göre Kaydedilir</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3">
                                    <table className="w-full text-base text-left">
                                        <thead className="text-sm text-gray-600 uppercase bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 w-24 font-bold">Sıra</th>
                                                <th className="px-4 py-3 font-bold">Ürün</th>
                                                <th className="px-4 py-3 text-right font-bold">Fiyat</th>
                                                <th className="px-4 py-3 w-20 text-center font-bold">Kaldır</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {groupItems.map((item, index) => (
                                                <tr key={item.stock_code} className="hover:bg-blue-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            value={item.orderVal}
                                                            onChange={(e) => handleOrderChange(index, e.target.value)}
                                                            className="w-20 border-2 border-gray-200 rounded-lg px-2 py-2 text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-gray-800">{item.name}</div>
                                                        <div className="text-sm text-gray-500 font-mono">{item.stock_code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-700">
                                                        ₺{item.price?.toLocaleString('tr-TR') || '0'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(item.stock_code)}
                                                            className="p-2 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                                                            title="Kaldır"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {groupItems.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-16 text-gray-400">
                                                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                        </svg>
                                                        <p className="text-lg font-medium">Bu grupta henüz ürün yok</p>
                                                        <p className="text-sm mt-1">Soldan ürün seçerek gruba ekleyebilirsiniz</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer - Larger Buttons */}
                <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Vazgeç
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-base font-bold hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {saving ? 'Kaydediliyor...' : 'Kaydet ve Kapat'}
                    </button>
                </div>
            </div>
        </div>
    );
}
