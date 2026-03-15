import React, { useState, useEffect } from 'react';
import { salesAPI, productsAPI } from '../../services/api';

export default function SaleDetailModal({ sale, onClose, onUpdate, onDelete }) {
    const [editedProducts, setEditedProducts] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showAddProductModal, setShowAddProductModal] = useState(false);

    // Add Product Modal State
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [passwordPrompt, setPasswordPrompt] = useState({ show: false, action: null }); // 'update' or 'delete'

    useEffect(() => {
        if (sale) {
            const productItems = sale.items || sale.products || [];
            setEditedProducts(JSON.parse(JSON.stringify(productItems)));
        }
    }, [sale]);

    const calculateTotal = () => {
        return editedProducts.reduce((sum, p) => {
            const lineTotal = (p.price * p.quantity) * (1 - (p.discount_rate || 0) / 100);
            return sum + lineTotal;
        }, 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleUpdateProduct = (index, field, value) => {
        setEditedProducts(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleDeleteProduct = (index) => {
        if (confirm('Bu ürünü satıştan kaldırmak istediğinize emin misiniz?')) {
            setEditedProducts(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Add Product Logic
    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            setProducts(response.data?.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        }
    };

    const openAddProductModal = async () => {
        await loadProducts();
        setProductSearch('');
        setShowAddProductModal(true);
    };

    const addProductToSale = (product) => {
        const newProduct = {
            id: product.id,
            name: product.name,
            stock_code: product.stock_code,
            barcode: product.barcode,
            price: product.price,
            quantity: 1,
            discount_rate: 0
        };
        setEditedProducts(prev => [...prev, newProduct]);
        setShowAddProductModal(false);
    };

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.stock_code?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode?.includes(productSearch)
    );

    // Security & Save Logic
    const verifyPassword = (passwordKey) => {
        const storedPassword = localStorage.getItem(passwordKey) || '123456';
        const password = prompt('İşlem için parolayı girin:');
        return password === storedPassword;
    };

    const handleSaveChanges = async () => {
        // Updated requirement: Use "Satış Detaylarını Değiştirme Parolası" (sales_edit_password)
        // Fallback to '123456' if not set
        if (!verifyPassword('sales_edit_password')) {
            alert('Hatalı parola!');
            return;
        }

        setSaving(true);
        try {
            const newTotal = calculateTotal();
            await salesAPI.update(sale.sale_code, {
                products: editedProducts,
                total: newTotal
            });
            alert('Satış başarıyla güncellendi!');
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            alert('Güncelleme hatası: ' + (error.message || 'Bilinmeyen hata'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSale = async () => {
        if (!verifyPassword('sales_cancel_password')) {
            alert('Hatalı parola!');
            return;
        }

        if (confirm('Bu satışı iptal etmek istediğinize emin misiniz?')) {
            try {
                await salesAPI.delete(sale.sale_code);
                alert('Satış başarıyla iptal edildi.');
                if (onDelete) onDelete();
                onClose();
            } catch (error) {
                alert('Hata: ' + (error.response?.data?.message || error.message));
            }
        }
    };

    if (!sale) return null;

    const isReturn = sale.sale_code?.startsWith('RET');

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className={`${isReturn ? 'bg-gradient-to-br from-red-600 via-rose-600 to-red-700' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'} px-10 py-8`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 ${isReturn ? 'bg-white/20' : 'bg-gradient-to-br from-emerald-400 to-teal-500'} rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30`}>
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isReturn ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    )}
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-white tracking-tight">{isReturn ? 'İade Detayı' : 'Satış Detayı'}</h3>
                                <p className={isReturn ? 'text-red-100' : 'text-slate-400 text-base font-mono mt-1'}>{sale.sale_code}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 bg-gradient-to-b from-slate-50 to-white">
                    {/* Sale Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                            <p className="text-slate-500 text-sm font-medium mb-1">Müşteri</p>
                            <p className="font-bold text-slate-800 text-lg">{sale.customer}</p>
                        </div>
                        <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                            <p className="text-slate-500 text-sm font-medium mb-1">Ödeme</p>
                            <p className="font-bold text-slate-800 text-lg">{sale.payment_method}</p>
                        </div>
                        <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                            <p className="text-slate-500 text-sm font-medium mb-1">Tarih</p>
                            <p className="font-bold text-slate-800 text-lg">{formatDate(sale.date)}</p>
                        </div>
                        <div className={`${isReturn ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30'} rounded-2xl p-5 text-white shadow-xl`}>
                            <p className={`${isReturn ? 'text-red-100' : 'text-emerald-100'} text-sm font-medium mb-1`}>{isReturn ? 'İade Tutarı' : 'Toplam'}</p>
                            <p className="text-3xl font-bold">₺{calculateTotal().toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Products Table */}
                    <div className="mb-6 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-xl">Ürünler</h3>
                        {!isReturn && (
                            <button
                                onClick={openAddProductModal}
                                className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Ürün Ekle
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stok Kodu</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ürün Adı</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Miktar</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-32">Fiyat</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">İskonto %</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Toplam</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-16">Sil</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {editedProducts.map((p, i) => {
                                    const lineTotal = (p.price * p.quantity) * (1 - (p.discount_rate || 0) / 100);
                                    return (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-500 text-sm font-mono">{p.stock_code || '-'}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={p.quantity}
                                                    onChange={(e) => handleUpdateProduct(i, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-center border border-gray-200  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                                                    min="0"
                                                    step="0.01"
                                                    readOnly={isReturn}
                                                    disabled={isReturn}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={p.price}
                                                    onChange={(e) => handleUpdateProduct(i, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-center border border-gray-200  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                                                    min="0"
                                                    step="0.01"
                                                    readOnly={isReturn}
                                                    disabled={isReturn}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={p.discount_rate || 0}
                                                    onChange={(e) => handleUpdateProduct(i, 'discount_rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-center border border-gray-200  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                                                    min="0"
                                                    max="100"
                                                    readOnly={isReturn}
                                                    disabled={isReturn}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-800">₺{lineTotal.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {!isReturn && (
                                                    <button
                                                        onClick={() => handleDeleteProduct(i)}
                                                        className="p-2 text-red-500 hover:bg-red-50  transition-colors"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {editedProducts.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                Henüz ürün eklenmedi
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80">
                    <div className="flex items-center justify-between gap-4">
                        {!isReturn && !sale.is_deleted && (
                            <button
                                onClick={handleDeleteSale}
                                className="px-6 py-3 bg-red-50 text-red-600  font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Satışı İptal Et
                            </button>
                        )}
                        <div className="flex-1"></div>
                        <button
                            onClick={onClose}
                            className={`px-6 py-3 ${isReturn ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} font-bold transition-colors rounded-xl`}
                        >
                            {isReturn ? 'Kapat' : 'İptal'}
                        </button>
                        {!isReturn && (
                            <button
                                onClick={handleSaveChanges}
                                disabled={saving}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white  font-bold hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 disabled:opacity-50 rounded-xl"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent -full animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Değişiklikleri Kaydet
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Nested Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white  w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Add Product Header */}
                        <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 px-6 py-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm  flex items-center justify-center">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Ürün Ekle</h3>
                                        <p className="text-white/80 text-sm">{filteredProducts.length} bulunabilir ürün</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddProductModal(false)}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/30  flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="mt-4 relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                    <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Ürün adı, stok kodu veya barkod..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm text-white placeholder-purple-200  border border-white/30 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Product List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">Ürün bulunamadı</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {filteredProducts.slice(0, 50).map((product) => (
                                        <div
                                            key={product.id}
                                            onClick={() => addProductToSale(product)}
                                            className="bg-white  border border-gray-100 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all duration-300 cursor-pointer overflow-hidden group p-4 flex items-center gap-4"
                                        >
                                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500  flex items-center justify-center flex-shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-800 truncate group-hover:text-purple-600 transition-colors">{product.name}</h4>
                                                <p className="text-sm text-gray-500">{product.stock_code} | {product.barcode}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-purple-600">₺{product.price?.toFixed(2)}</p>
                                                <p className="text-xs text-gray-500">Stok: {product.stock}</p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80">
                            <button
                                onClick={() => setShowAddProductModal(false)}
                                className="w-full py-3 bg-gray-200 text-gray-700  font-bold hover:bg-gray-300 transition-colors"
                            >
                                İptal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

