import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

export default function CompanyInfoModal({ isOpen, onClose }) {
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyLogo, setCompanyLogo] = useState(null); // Base64 string
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const nameRes = await settingsAPI.get('company_name');
            const addressRes = await settingsAPI.get('company_address');
            const phoneRes = await settingsAPI.get('company_phone');
            const logoRes = await settingsAPI.get('company_logo');

            setCompanyName(nameRes.data || '');
            setCompanyAddress(addressRes.data || '');
            setCompanyPhone(phoneRes.data || '');
            setCompanyLogo(logoRes.data || null);

            // Also check receipt config for logo if not in settingsAPI (migration/fallback)
            if (!logoRes.data) {
                try {
                    const savedConfig = localStorage.getItem('receipt_design_config');
                    if (savedConfig) {
                        const parsed = JSON.parse(savedConfig);
                        if (parsed.logo_url) setCompanyLogo(parsed.logo_url);
                    }
                } catch (e) { }
            }

        } catch (e) {
            console.error("Error loading company settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500000) { // 500KB limit
                alert("Logo boyutu 500KB'dan küçük olmalıdır.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setCompanyLogo(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsAPI.set('company_name', companyName.trim());
            await settingsAPI.set('company_address', companyAddress.trim());
            await settingsAPI.set('company_phone', companyPhone.trim());
            if (companyLogo) {
                await settingsAPI.set('company_logo', companyLogo);
            }

            // Sync with Receipt Designer Config in localStorage
            try {
                const savedConfigStr = localStorage.getItem('receipt_design_config');
                let config = savedConfigStr ? JSON.parse(savedConfigStr) : {};

                // Update fields
                config.name = companyName.trim();
                config.address = companyAddress.trim();
                config.phone = companyPhone.trim();
                if (companyLogo) {
                    config.logo_url = companyLogo;
                }

                // If config was empty, set some defaults to avoid breaking
                if (!config.type) config.type = 'custom_html_a5';
                if (!config.logo_text) config.logo_text = companyName.trim().charAt(0).toUpperCase() || 'A';
                if (config.showWatermark === undefined) config.showWatermark = true;

                localStorage.setItem('receipt_design_config', JSON.stringify(config));

            } catch (err) {
                console.error("Error syncing with receipt config", err);
            }

            alert("Firma bilgileri ve logo başarıyla kaydedildi.");
            onClose();
        } catch (e) {
            console.error("Error saving company settings", e);
            alert("Firma bilgileri kaydedilemedi: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans">
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                style={{
                    animation: 'modalSlideIn 0.3s ease-out'
                }}
            >
                {/* Header - Premium Gradient with Icon */}
                <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-8 overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                    </div>

                    <div className="relative flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Firma Bilgileri</h2>
                                <p className="text-purple-200 mt-1">İşletmenizin temel bilgilerini yönetin</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white hover:bg-white/20 p-3 rounded-xl transition-all duration-200 hover:rotate-90"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
                    {loading ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-500 font-medium">Firma bilgileri yükleniyor...</p>
                        </div>
                    ) : (
                        <>
                            {/* Company Name Field */}
                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                    <span className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </span>
                                    Firma İsmi
                                </label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Örn: ABC Ticaret Ltd. Şti."
                                    className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all text-gray-800 text-base placeholder:text-gray-400 hover:border-gray-300"
                                />
                            </div>

                            {/* Company Address Field */}
                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                    <span className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </span>
                                    Firma Adresi
                                </label>
                                <textarea
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    placeholder="Örn: Atatürk Cad. No:123, Merkez/İstanbul"
                                    rows={3}
                                    className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-gray-800 text-base placeholder:text-gray-400 hover:border-gray-300 resize-none"
                                />
                            </div>

                            {/* Company Phone Field */}
                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                    <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </span>
                                    Firma İletişim Numarası
                                </label>
                                <input
                                    type="tel"
                                    value={companyPhone}
                                    onChange={(e) => setCompanyPhone(e.target.value)}
                                    placeholder="Örn: 0212 555 1234"
                                    className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-800 text-base placeholder:text-gray-400 hover:border-gray-300"
                                />
                            </div>

                            {/* Company Logo Field */}
                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                    <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </span>
                                    Firma Logosu
                                </label>
                                <div className="flex items-center gap-4">
                                    {companyLogo && (
                                        <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white p-1">
                                            <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all text-gray-800 text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                                    />
                                    {companyLogo && (
                                        <button
                                            onClick={() => setCompanyLogo(null)}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                                        >
                                            Kaldır
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Fişlerde kullanılacak logo. (Önerilen: Kare format, Max 500KB)</p>
                            </div>

                            {/* Info Box */}
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200/50">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-amber-800 font-medium">Bilgi</p>
                                        <p className="text-amber-700 text-sm mt-1">Bu bilgiler ve logo fişlerde/raporlarda otomatik olarak kullanılacaktır.</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white px-8 py-5 border-t border-gray-100 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-200 transition-all flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-base font-bold hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Kaydediliyor...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Kaydet
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Custom Animation Keyframes */}
            <style>{`
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
