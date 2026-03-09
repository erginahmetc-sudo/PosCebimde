import React, { useState, useEffect } from 'react';
import { productsAPI } from '../../services/api';

export default function ProductFormModal({ isOpen, onClose, onSuccess, product = null, initialValues = null }) {
    const [formData, setFormData] = useState({
        name: '',
        stock_code: '',
        barcode: '',
        price: '',
        stock: '',
        group: '',
        brand: '',
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setFormData({
                    name: product.name || '',
                    stock_code: product.stock_code || '',
                    barcode: product.barcode || '',
                    price: product.price?.toString() || '',
                    stock: product.stock?.toString() || '',
                    group: product.group || '',
                    brand: product.brand || '',
                });
            } else {
                setFormData({
                    name: '',
                    stock_code: initialValues?.stock_code || generateStockCode(),
                    barcode: initialValues?.barcode || '',
                    price: '',
                    stock: '',
                    group: '',
                    brand: '',
                });
            }
            setError('');
        }
    }, [isOpen, product, initialValues]);

    const generateStockCode = () => {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        return `STK-${randomNum}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                price: parseFloat(formData.price) || 0,
                stock: parseInt(formData.stock) || 0,
            };

            if (product) {
                await productsAPI.update(product.stock_code, data);
            } else {
                await productsAPI.add(data);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || '';
            if (msg.includes('products_stock_code') && msg.includes('unique')) {
                setError(`"${formData.stock_code}" stok kodu sistemde zaten kayıtlıdır.`);
            } else {
                setError(msg || 'Bir hata oluştu.');
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-6 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {product ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    )}
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    {product ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
                                </h2>
                                <p className="text-slate-400 text-sm mt-0.5">Ürün bilgilerini doldurun</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50 to-white">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Ürün Adı <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 text-lg rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Ürün adını giriniz..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Stok Kodu <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={formData.stock_code}
                                onChange={(e) => setFormData({ ...formData, stock_code: e.target.value })}
                                className={`w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono ${product ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                                placeholder="STK-001"
                                required
                                disabled={!!product}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Barkod</label>
                            <input
                                type="text"
                                value={formData.barcode}
                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                                placeholder="869..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Fiyat (₺) <span className="text-rose-500">*</span></label>
                            <input
                                type="number"
                                step="any"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="w-full px-4 py-3 text-xl font-bold rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Stok Miktarı</label>
                            <input
                                type="number"
                                value={formData.stock}
                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                className="w-full px-4 py-3 text-xl rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Marka</label>
                            <input
                                type="text"
                                value={formData.brand}
                                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Marka..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Grup</label>
                            <input
                                type="text"
                                value={formData.group}
                                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Grup..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 text-base font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] py-3.5 text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                            ✓ {product ? 'Güncelle' : 'Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
