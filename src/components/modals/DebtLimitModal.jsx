import React, { useState, useEffect } from 'react';
import { settingsAPI, customersAPI } from '../../services/api';

export default function DebtLimitModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [debtLimits, setDebtLimits] = useState({}); // { customer_id: limit_amount }
    const [selectedGroup, setSelectedGroup] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');

    const groups = ['Tümü', 'Cari', 'Perakende', 'Firmalar'];

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Parallel fetch: Customers and Existing Limits
            const [customersRes, settingsRes] = await Promise.all([
                customersAPI.getAll(),
                settingsAPI.get('customer_debt_limits')
            ]);

            setCustomers(customersRes.data?.customers || []);

            // Limit settings might be empty or null
            const limits = settingsRes.data || {};
            setDebtLimits(limits);

        } catch (error) {
            console.error("Error loading debt limit data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLimitChange = (customerId, value) => {
        setDebtLimits(prev => ({
            ...prev,
            [customerId]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Clean up empty limits before saving
            const limitsToSave = {};
            Object.keys(debtLimits).forEach(key => {
                const val = parseFloat(debtLimits[key]);
                if (!isNaN(val) && val > 0) {
                    limitsToSave[key] = val;
                }
            });

            await settingsAPI.set('customer_debt_limits', limitsToSave);
            alert("Borç limitleri başarıyla kaydedildi.");
            onClose();
        } catch (error) {
            console.error("Error saving debt limits", error);
            alert("Limitler kaydedilirken hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    // Filter Logic
    const filteredCustomers = customers.filter(c => {
        const matchesGroup = selectedGroup === 'Tümü' || (c.group || 'Cari') === selectedGroup;
        const matchesSearch = !searchTerm || (
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.customer_code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesGroup && matchesSearch && c.is_active !== false;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-8 py-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <span className="material-symbols-outlined text-2xl">credit_score</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Borç Limitleri</h2>
                            <p className="text-rose-100 text-sm">Müşteri bazlı veresiye limiti belirleyin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="p-6 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Müşteri Grubu</label>
                        <select
                            value={selectedGroup}
                            onChange={(e) => setSelectedGroup(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-gray-300 border focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
                        >
                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Müşteri Ara</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="İsim veya kod ile ara..."
                            className="w-full px-4 py-3 rounded-xl border-gray-300 border focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                                    <th className="pb-3 pl-2 font-semibold">Müşteri</th>
                                    <th className="pb-3 font-semibold">Grubu</th>
                                    <th className="pb-3 font-semibold">Güncel Bakiye</th>
                                    <th className="pb-3 font-semibold">Borç Limiti (TL)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                                            Kriterlere uygun müşteri bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map(customer => {
                                        const balance = parseFloat(customer.balance) || 0;
                                        const currentLimit = debtLimits[customer.id] || '';

                                        return (
                                            <tr key={customer.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="py-3 pl-2">
                                                    <div className="font-semibold text-gray-800">{customer.name}</div>
                                                    <div className="text-xs text-gray-400">{customer.customer_code}</div>
                                                </td>
                                                <td className="py-3 text-gray-600">{customer.group || 'Cari'}</td>
                                                <td className={`py-3 font-medium ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {balance.toFixed(2)} TL
                                                </td>
                                                <td className="py-3">
                                                    <div className="relative max-w-[140px]">
                                                        <input
                                                            type="number"
                                                            value={currentLimit}
                                                            onChange={(e) => handleLimitChange(customer.id, e.target.value)}
                                                            placeholder="Limit Yok"
                                                            className={`w-full px-3 py-2 rounded-lg border-2 outline-none transition-all font-bold text-right
                                                                ${currentLimit ? 'border-rose-200 bg-rose-50 text-rose-700 focus:border-rose-500' : 'border-gray-200 focus:border-gray-400'}
                                                            `}
                                                        />
                                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">TL</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Kaydediliyor...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">save</span>
                                Kaydet
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
