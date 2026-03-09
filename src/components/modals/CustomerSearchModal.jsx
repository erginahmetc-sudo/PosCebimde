/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react';
import { customersAPI } from '../../services/api';

export default function CustomerSearchModal({ onClose, onSelect }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('all');

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const response = await customersAPI.getAll();
                setCustomers(response.data?.customers || []);
            } catch (error) {
                console.error('Müşteriler yüklenirken hata:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, []);

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return customers;
        const term = searchTerm.toLowerCase();

        return customers.filter(c => {
            if (searchField === 'all') {
                return (
                    (c.name || '').toLowerCase().includes(term) ||
                    (c.company || '').toLowerCase().includes(term) ||
                    (c.customer_code || '').toLowerCase().includes(term) ||
                    (c.tax_number || '').includes(term) ||
                    (c.tax_office || '').toLowerCase().includes(term) ||
                    (c.city || '').toLowerCase().includes(term)
                );
            }
            if (searchField === 'name') return (c.name || '').toLowerCase().includes(term);
            if (searchField === 'company') return (c.company || '').toLowerCase().includes(term);
            if (searchField === 'tax_number') return (c.tax_number || '').includes(term);
            if (searchField === 'customer_code') return (c.customer_code || '').toLowerCase().includes(term);
            return true;
        });
    }, [customers, searchTerm, searchField]);

    const handleSelect = (customer) => {
        onSelect({
            name: customer.company || customer.name || '',
            taxOffice: customer.tax_office || '',
            taxNo: customer.tax_number || '',
            email: customer.email || '',
            phone: customer.phone || '',
            customerId: customer.id,
            customerCode: customer.customer_code || '',
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <span className="material-symbols-outlined text-white">person_search</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Cari Seçimi</h2>
                                <p className="text-blue-200 text-sm">{customers.length} kayıtlı cari</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                        >
                            <span className="material-symbols-outlined text-white">close</span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Cari ara... (Ad, Firma, Vergi No, Kod)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <select
                            className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchField}
                            onChange={(e) => setSearchField(e.target.value)}
                        >
                            <option value="all">Tüm Alanlarda</option>
                            <option value="name">Kısa Adı</option>
                            <option value="company">Firma Adı</option>
                            <option value="tax_number">Vergi No</option>
                            <option value="customer_code">Müşteri Kodu</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                <p className="text-slate-500 text-sm font-medium">Cariler yükleniyor...</p>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-5xl mb-3">search_off</span>
                            <p className="font-medium">Sonuç bulunamadı</p>
                            <p className="text-sm mt-1">Farklı bir arama terimi deneyin</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                <tr className="text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-4 py-3">Kod</th>
                                    <th className="px-4 py-3">Kısa Adı</th>
                                    <th className="px-4 py-3">Firma</th>
                                    <th className="px-4 py-3">Vergi Dairesi</th>
                                    <th className="px-4 py-3">Vergi No</th>
                                    <th className="px-4 py-3">Şehir</th>
                                    <th className="px-4 py-3 text-right">Bakiye</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filtered.map((customer) => {
                                    const balance = parseFloat(customer.balance) || 0;
                                    return (
                                        <tr
                                            key={customer.id}
                                            onClick={() => handleSelect(customer)}
                                            className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group"
                                        >
                                            <td className="px-4 py-3 text-sm font-mono font-bold text-slate-600">{customer.customer_code || '-'}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{customer.name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{customer.company || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{customer.tax_office || '-'}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-slate-600">{customer.tax_number || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{customer.city || '-'}</td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-green-500' : 'text-slate-400'}`}>
                                                {balance.toFixed(2)} TL
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        <span className="font-semibold text-slate-700">{filtered.length}</span> sonuç gösteriliyor
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
}
