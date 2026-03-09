import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

export default function SecretTokenModal({ isOpen, onClose }) {
    const [secretToken, setSecretToken] = useState('Yükleniyor...');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadToken();
        }
    }, [isOpen]);

    const loadToken = async () => {
        try {
            const { data } = await settingsAPI.get('secret_token');
            setSecretToken(data || '');
        } catch (e) {
            console.error("Error fetching secret token", e);
            setSecretToken('Hata');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsAPI.set('secret_token', secretToken.trim());
            alert("Token başarıyla kaydedildi.");
            onClose();
        } catch (e) {
            console.error("Error saving token", e);
            alert("Bağlantı hatası: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerate = async () => {
        if (!window.confirm("UYARI: Secret Token'ı değiştirmek, mevcut entegrasyonların (BirFatura vb.) çalışmasını durdurabilir ve yeni token'ı o sistemlere tekrar girmeniz gerekir.\n\nDevam etmek istiyor musunuz?")) {
            return;
        }

        const newToken = crypto.randomUUID();
        setSaving(true);
        try {
            await settingsAPI.set('secret_token', newToken);
            setSecretToken(newToken);
            // alert("Yeni token oluşturuldu. Kaydet butonuna basmayı unutmayın."); // No need, we save immediately or just update state? 
            // The request asked for "Yeni Secret Token butonu koyalım. Her şirket isterse burdan yenileyebilir."
            // And "database'de kayıtlı kalsın".
            // Implementation: I'll overwrite the DB immediately with the new token.

            alert("Yeni token oluşturuldu ve kaydedildi.");
        } catch (e) {
            console.error("Error regenerating token", e);
            alert("Token oluşturulamadı: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                {/* Header - Modern Gradient */}
                <div className="bg-gradient-to-r from-red-500 to-rose-600 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Entegrasyon Token Yönetimi</h2>
                            <p className="text-red-100 mt-1">Sipariş / Stok Entegrasyon Güvenlik Anahtarı</p>
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
                <div className="p-8 space-y-6">
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-xl text-base text-amber-800 border border-amber-200">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p>
                                Bu token, dış sistemlerin (örn. <strong>BirFatura paneli</strong>) bu programa bağlanıp siparişleri çekebilmesi için kullanılır.
                                <strong> Lütfen güvenli bir yerde saklayın ve kimseyle paylaşmayın.</strong>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-base font-semibold text-gray-800">Secret Token</label>
                            <button
                                onClick={handleRegenerate}
                                className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Yeni Secret Token Oluştur
                            </button>
                        </div>
                        <input
                            type="text"
                            value={secretToken}
                            readOnly
                            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 focus:ring-0 cursor-not-allowed font-mono text-base"
                        />
                        <p className="text-xs text-gray-500">
                            Token'ı değiştirmek için yukarıdaki "Yeni Secret Token Oluştur" bağlantısını kullanın.
                        </p>
                    </div>
                </div>

                {/* Footer - Larger Buttons */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 border-t border-gray-200 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm flex items-center gap-2"
                    >
                        Kapat
                    </button>
                    {/* Save button removed because we save on generation now, or we can keep it for visual consistency but it's redundant if readonly */}
                </div>
            </div>
        </div>
    );
}
