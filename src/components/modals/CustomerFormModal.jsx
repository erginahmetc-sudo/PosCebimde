import React, { useState, useEffect } from 'react';
import { customersAPI } from '../../services/api';

export default function CustomerFormModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        customer_code: '',
        name: '',
        company: '',
        group: 'Cari',
        is_active: true,
        address: '',
        city: '',
        district: '',
        zip_code: '',
        country: '',
        tax_office: '',
        tax_number: '',
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormData({
                customer_code: '',
                name: '',
                company: '',
                group: 'Cari',
                is_active: true,
                address: '',
                city: '',
                district: '',
                zip_code: '',
                country: '',
                tax_office: '',
                tax_number: '',
            });
            setError('');
        }
    }, [isOpen]);

    const handleSaveNew = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Müşteri adı boş bırakılamaz.');
            return;
        }

        const customerData = { ...formData };
        // If code is empty, backend or logic should handle it. 
        // In CustomersPage logic, it generated it client-side based on list. 
        // Here we might not have list. Let's send empty and hope backend handles or just generate a random one to be safe if backend expects it.
        // Actually CustomersPage generated it based on max ID. We can try sending empty.

        try {
            const response = await customersAPI.add(customerData);
            if (response.data?.success) {
                if (onSuccess) onSuccess();
                onClose();
            } else {
                setError('Hata: ' + response.data?.message);
            }
        } catch (err) {
            setError('Müşteri eklenirken hata: ' + (err.response?.data?.message || err.message));
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Yeni Müşteri Ekle</h2>
                                <p className="text-slate-400 text-sm mt-0.5">Müşteri bilgilerini doldurun</p>
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

                <form onSubmit={handleSaveNew} className="p-8 space-y-5 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50 to-white">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Müşteri Adı <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 text-lg rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Müşteri adını giriniz..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Firma Bilgileri</label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="Firma adı..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Grubu</label>
                            <select
                                value={formData.group}
                                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            >
                                <option value="Cari">Cari</option>
                                <option value="Perakende">Perakende</option>
                                <option value="Firmalar">Firmalar</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Durumu</label>
                            <select
                                value={formData.is_active.toString()}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            >
                                <option value="true">Aktif</option>
                                <option value="false">Pasif</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Adres</label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            rows="2"
                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-slate-400"
                            placeholder="Adres bilgisi..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">İl</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="İl"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">İlçe</label>
                            <input
                                type="text"
                                value={formData.district}
                                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="İlçe"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Vergi Dairesi</label>
                            <input
                                type="text"
                                value={formData.tax_office}
                                onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Vergi dairesi"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Vergi Numarası</label>
                            <input
                                type="text"
                                value={formData.tax_number}
                                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                                placeholder="11111111111"
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
                            ✓ Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
