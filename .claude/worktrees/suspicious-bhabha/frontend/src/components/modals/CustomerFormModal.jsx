import React, { useState, useEffect, useMemo } from 'react';
import { customersAPI } from '../../services/api';
import { birFaturaAPI } from '../../services/birFaturaService';

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
    const [taxPayerLoading, setTaxPayerLoading] = useState(false);
    const [taxPayerResult, setTaxPayerResult] = useState(null);
    const [taxOffices, setTaxOffices] = useState([]);
    const [taxOfficeSearch, setTaxOfficeSearch] = useState('');
    const [showTaxOfficeDropdown, setShowTaxOfficeDropdown] = useState(false);

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
            setTaxPayerResult(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const loadTaxOffices = async () => {
            const cached = sessionStorage.getItem('birfatura_tax_offices');
            if (cached) {
                try { setTaxOffices(JSON.parse(cached)); return; } catch (e) {}
            }
            const result = await birFaturaAPI.getTaxOffices();
            if (result.success && result.data) {
                setTaxOffices(result.data);
                sessionStorage.setItem('birfatura_tax_offices', JSON.stringify(result.data));
            }
        };
        loadTaxOffices();
    }, []);

    const filteredTaxOffices = useMemo(() => {
        const search = (taxOfficeSearch || formData.tax_office || '').toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
        if (!search || search.length < 2) return [];
        return taxOffices.filter(o => {
            const name = (o.TaxOfficeName || '').toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
            return name.includes(search);
        }).slice(0, 10);
    }, [taxOfficeSearch, formData.tax_office, taxOffices]);

    const taxNumDigits = formData.tax_number.replace(/\D/g, '');
    const isTCKN = taxNumDigits.length === 11;

    const handleTaxPayerQuery = async () => {
        if (taxNumDigits.length < 10) return;
        setTaxPayerLoading(true);
        setTaxPayerResult(null);
        const result = await birFaturaAPI.queryTaxPayer(taxNumDigits);
        setTaxPayerLoading(false);
        if (result.success && result.data) {
            const title = result.data.title || result.data.name || '';
            setFormData(prev => ({
                ...prev,
                name: title || prev.name,
                company: title || prev.company,
            }));
            setTaxPayerResult({ isEFatura: true, title });
        } else if (result.success && !result.data) {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        } else {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        }
    };

    const handleSaveNew = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Müşteri adı boş bırakılamaz.');
            return;
        }

        const customerData = { ...formData };

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
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-5 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Yeni Müşteri Ekle</h2>
                                <p className="text-slate-400 text-xs mt-0.5">Müşteri bilgilerini doldurun</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSaveNew} className="p-6 space-y-4 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50 to-white">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700">Müşteri Adı <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Müşteri adını giriniz..."
                                required
                                autoFocus
                            />
                        </div>

                        {/* TC / Vergi No + Müşteriyi Getir */}
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700">TC Kimlik / Vergi Numarası</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.tax_number}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                        setFormData(prev => ({ ...prev, tax_number: val }));
                                        setTaxPayerResult(null);
                                    }}
                                    maxLength={11}
                                    className="flex-1 px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider"
                                    placeholder="VKN (10) veya TCKN (11)"
                                />
                                {taxNumDigits.length >= 10 && (
                                    <button
                                        type="button"
                                        onClick={handleTaxPayerQuery}
                                        disabled={taxPayerLoading}
                                        className="px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        {taxPayerLoading ? (
                                            <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Sorgulanıyor</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-base">person_search</span> Müşteriyi Getir</>
                                        )}
                                    </button>
                                )}
                            </div>
                            {taxPayerResult && (
                                <div className={`mt-1 px-3 py-2 rounded-lg text-xs font-medium ${
                                    taxPayerResult.isEFatura
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {taxPayerResult.isEFatura ? (
                                        <><span className="material-symbols-outlined text-sm align-middle mr-1">verified</span> e-Fatura Mükellefi: {taxPayerResult.title}</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-sm align-middle mr-1">info</span> {taxPayerResult.message}</>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700">Firma Bilgileri</label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                placeholder="Firma adı..."
                            />
                        </div>

                        {/* Vergi Dairesi with autocomplete */}
                        <div className="space-y-1 relative">
                            <label className="block text-sm font-semibold text-slate-700">
                                Vergi Dairesi
                                {isTCKN && <span className="text-xs text-slate-400 font-normal ml-2">(TCKN için gerekli değil)</span>}
                            </label>
                            <input
                                type="text"
                                value={isTCKN ? '' : formData.tax_office}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, tax_office: e.target.value }));
                                    setTaxOfficeSearch(e.target.value);
                                    setShowTaxOfficeDropdown(true);
                                }}
                                onFocus={() => { if (!isTCKN) setShowTaxOfficeDropdown(true); }}
                                onBlur={() => setTimeout(() => setShowTaxOfficeDropdown(false), 200)}
                                autoComplete="off"
                                disabled={isTCKN}
                                className={`w-full px-4 py-3 text-base rounded-xl border-2 outline-none transition-all placeholder:text-slate-400 ${
                                    isTCKN
                                        ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                                        : 'border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500'
                                }`}
                                placeholder={isTCKN ? 'TCKN için gerekli değil' : 'Vergi dairesi adı yazın...'}
                            />
                            {showTaxOfficeDropdown && filteredTaxOffices.length > 0 && !isTCKN && (
                                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filteredTaxOffices.map((office, idx) => (
                                        <div
                                            key={office.TaxOfficeCode || idx}
                                            className="px-4 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                                            onMouseDown={() => {
                                                setFormData(prev => ({ ...prev, tax_office: office.TaxOfficeName }));
                                                setShowTaxOfficeDropdown(false);
                                                setTaxOfficeSearch('');
                                            }}
                                        >
                                            <span className="font-medium text-slate-700">{office.TaxOfficeName}</span>
                                            <span className="text-slate-400 ml-2 text-xs">({office.TaxOfficeCode})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
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
                        <div className="space-y-1">
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

                    <div className="space-y-1">
                        <label className="block text-sm font-semibold text-slate-700">Adres</label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            rows="2"
                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-slate-400"
                            placeholder="Adres bilgisi..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700">İl</label>
                            <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="İl" />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-semibold text-slate-700">İlçe</label>
                            <input type="text" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="İlçe" />
                        </div>
                    </div>

                    <div className="pt-3 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 text-base font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]">
                            İptal
                        </button>
                        <button type="submit" className="flex-[2] py-3.5 text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]">
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
