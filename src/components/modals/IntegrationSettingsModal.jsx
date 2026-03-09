import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

export default function IntegrationSettingsModal({ isOpen, onClose }) {
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [integrationKey, setIntegrationKey] = useState('');
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
            // Load from database (per-company)
            const apiKeyRes = await settingsAPI.get('birfatura_api_key');
            const secretKeyRes = await settingsAPI.get('birfatura_secret_key');
            const integrationKeyRes = await settingsAPI.get('birfatura_integration_key');

            setApiKey(apiKeyRes.data || '');
            setSecretKey(secretKeyRes.data || '');
            setIntegrationKey(integrationKeyRes.data || '');
        } catch (e) {
            console.error("Error loading birfatura settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to database (per-company)
            await settingsAPI.set('birfatura_api_key', apiKey.trim());
            await settingsAPI.set('birfatura_secret_key', secretKey.trim());
            await settingsAPI.set('birfatura_integration_key', integrationKey.trim());



            alert("Ayarlar başarıyla kaydedildi.");
            onClose();
        } catch (e) {
            console.error("Error saving settings", e);
            alert("Ayarlar kaydedilemedi: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                {/* Header - Modern Gradient */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">BirFatura Entegrasyonu</h2>
                            <p className="text-amber-100 mt-1">E-Fatura / E-Arşiv API Anahtarlarını Yönetin</p>
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

                {/* Body - More Spacious */}
                <div className="p-8 space-y-6 overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">
                            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4"></div>
                            Ayarlar yükleniyor...
                        </div>
                    ) : (
                        <>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl text-base text-blue-800 border border-blue-200">
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>Lütfen <strong>BirFatura paneli</strong>nden aldığınız API anahtarlarını aşağıdaki alanlara giriniz. Bu bilgiler şirketinize özel olarak veritabanında saklanır.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-base font-semibold text-gray-800">API Key</label>
                                <input
                                    type="text"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="BirFatura API Key"
                                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-base font-semibold text-gray-800">Secret Key</label>
                                <input
                                    type="password"
                                    value={secretKey}
                                    onChange={(e) => setSecretKey(e.target.value)}
                                    placeholder="BirFatura Secret Key"
                                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-base font-semibold text-gray-800">Integration Key</label>
                                <input
                                    type="text"
                                    value={integrationKey}
                                    onChange={(e) => setIntegrationKey(e.target.value)}
                                    placeholder="BirFatura Integration Key"
                                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono text-base"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer - Larger Buttons */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 border-t border-gray-200 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-base font-bold hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}
