import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ShortcutGroupsModal from '../components/modals/ShortcutGroupsModal';
import ReceiptDesignerModal from '../components/modals/ReceiptDesignerModal';
import IntegrationSettingsModal from '../components/modals/IntegrationSettingsModal';
import SecretTokenModal from '../components/modals/SecretTokenModal';
import CompanyInfoModal from '../components/modals/CompanyInfoModal';
import DebtLimitModal from '../components/modals/DebtLimitModal';
import { settingsAPI, productsAPI } from '../services/api';
import StatusModal from '../components/modals/StatusModal';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    // Settings State
    const [askQuantity, setAskQuantity] = useState(false);
    const [cancelPassword, setCancelPassword] = useState('123456');
    const [editSalePassword, setEditSalePassword] = useState('123456');
    const [showTotalSales, setShowTotalSales] = useState(true);
    const [showTotalRevenue, setShowTotalRevenue] = useState(true);
    const [showInvoiceTotal, setShowInvoiceTotal] = useState(true);
    const [sendSalesToBirFatura, setSendSalesToBirFatura] = useState(false);
    const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

    const [receiptPaperSize, setReceiptPaperSize] = useState('A5 (148x210mm)');
    const [secretToken, setSecretToken] = useState('...');

    // Modals
    const [showShortcutModal, setShowShortcutModal] = useState(false);
    const [showReceiptDesigner, setShowReceiptDesigner] = useState(false);
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [showSecretTokenModal, setShowSecretTokenModal] = useState(false);
    const [showCompanyInfoModal, setShowCompanyInfoModal] = useState(false);
    const [showDebtLimitModal, setShowDebtLimitModal] = useState(false);
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('open') === 'shortcuts') {
            setShowShortcutModal(true);
        }
    }, [location]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data } = await settingsAPI.getAll();
            if (data) {
                if (data['pos_settings_ask_quantity'] !== undefined) setAskQuantity(data['pos_settings_ask_quantity']);
                if (data['sales_cancel_password']) setCancelPassword(data['sales_cancel_password']);
                if (data['sales_edit_password']) setEditSalePassword(data['sales_edit_password']);
                if (data['sales_show_total_sales'] !== undefined) setShowTotalSales(data['sales_show_total_sales']);
                if (data['sales_show_total_revenue'] !== undefined) setShowTotalRevenue(data['sales_show_total_revenue']);

                if (data['invoices_show_total'] !== undefined) {
                    setShowInvoiceTotal(data['invoices_show_total']);
                    localStorage.setItem('invoices_show_total', data['invoices_show_total']);
                }

                if (data['integration_send_sales_to_birfatura'] !== undefined) setSendSalesToBirFatura(data['integration_send_sales_to_birfatura']);

                // Sync to localStorage
                if (data['receipt_auto_print'] !== undefined) {
                    setAutoPrintReceipt(data['receipt_auto_print']);
                    localStorage.setItem('receipt_auto_print', data['receipt_auto_print']);
                }

                if (data['receipt_paper_size']) {
                    setReceiptPaperSize(data['receipt_paper_size']);
                    localStorage.setItem('receipt_paper_size', data['receipt_paper_size']);
                }

                if (data['secret_token']) setSecretToken(data['secret_token']);

                // Restore BirFatura Config to localStorage
                if (data['birfatura_api_key'] || data['birfatura_secret_key'] || data['birfatura_integration_key']) {
                    const birfaturaConfig = {
                        api_key: data['birfatura_api_key'] || '',
                        secret_key: data['birfatura_secret_key'] || '',
                        integration_key: data['birfatura_integration_key'] || ''
                    };
                    localStorage.setItem('birfatura_config', JSON.stringify(birfaturaConfig));
                }
            }
        } catch (error) {
            console.error("Settings load error:", error);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    const updateSetting = async (key, value) => {
        try {
            await settingsAPI.set(key, value);
            // Sync specific keys to localStorage
            if (key === 'receipt_auto_print') localStorage.setItem(key, value);
            if (key === 'receipt_paper_size') localStorage.setItem(key, value);
            if (key === 'invoices_show_total') localStorage.setItem(key, value);
            
            setStatusModal({
                isOpen: true,
                title: 'Başarılı',
                message: 'Ayarlar başarıyla kaydedildi.',
                type: 'success'
            });
        } catch (err) {
            console.error(`Failed to save setting ${key}:`, err);
            setStatusModal({
                isOpen: true,
                title: 'Hata',
                message: 'Ayar kaydedilemedi.',
                type: 'error'
            });
        }
    };

    const toggleAskQuantity = () => {
        const newValue = !askQuantity;
        setAskQuantity(newValue);
        updateSetting('pos_settings_ask_quantity', newValue);
    };

    const handlePasswordChange = async (e) => {
        const newPassword = e.target.value;
        setCancelPassword(newPassword);
        updateSetting('sales_cancel_password', newPassword);
    };

    const handleEditSalePasswordChange = async (e) => {
        const newPassword = e.target.value;
        setEditSalePassword(newPassword);
        updateSetting('sales_edit_password', newPassword);
    };

    const toggleShowTotalSales = () => {
        const newValue = !showTotalSales;
        setShowTotalSales(newValue);
        updateSetting('sales_show_total_sales', newValue);
    };

    const toggleShowTotalRevenue = () => {
        const newValue = !showTotalRevenue;
        setShowTotalRevenue(newValue);
        updateSetting('sales_show_total_revenue', newValue);
    };

    const toggleShowInvoiceTotal = () => {
        const newValue = !showInvoiceTotal;
        setShowInvoiceTotal(newValue);
        updateSetting('invoices_show_total', newValue);
    };

    const toggleSendSalesToBirFatura = () => {
        const newValue = !sendSalesToBirFatura;
        setSendSalesToBirFatura(newValue);
        updateSetting('integration_send_sales_to_birfatura', newValue);
    };



    return (
        <div className="min-h-screen p-6 relative">
            {loading && (
                <div className="absolute inset-0 z-[100] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-fashion transition-all duration-500">
                    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center animate-fade-in-up">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl animate-pulse-glow"></div>
                            <div className="relative w-24 h-24 flex items-center justify-center border border-slate-100 dark:border-slate-800 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-blue-600 font-extralight scale-125">
                                    settings
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-center leading-relaxed text-slate-900 dark:text-slate-100">
                            Ayarlarınız <br />
                            <span className="font-medium">Yükleniyor</span>
                        </h1>
                        <p className="text-sm font-light text-slate-400 dark:text-slate-500 tracking-wider h-5 typewriter-cursor animate-typewriter">
                            Lütfen bekleyiniz...
                        </p>

                        <div className="w-full max-w-[280px] mt-12">
                            <div className="relative h-[2px] w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                <div className="absolute top-0 h-full bg-blue-600 animate-progress shadow-[0_0_10px_#2563eb]"></div>
                                <div className="absolute top-[-2px] h-[6px] bg-blue-600/30 blur-sm animate-progress w-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Ayarlar</h1>

            {/* Firma Bilgileri Bölümü */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Firma Bilgileri
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Firma Bilgilerini Yönet</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                İşletmenizin adı, adresi ve iletişim bilgilerini düzenleyin. Bu bilgiler fişlerde ve raporlarda kullanılır.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowCompanyInfoModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 font-semibold text-sm transition-all shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Firma Bilgileri
                        </button>
                    </div>

                    {/* Debt Limit Section */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg border border-rose-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Veresiye Limitleri</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Müşteri gruplarına veya kişilere özel borç limiti tanımlayın.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowDebtLimitModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg hover:from-rose-700 hover:to-pink-700 font-semibold text-sm transition-all shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">credit_score</span>
                            Borç Limitleri
                        </button>
                    </div>
                </div>
            </div>

            <DebtLimitModal
                isOpen={showDebtLimitModal}
                onClose={() => setShowDebtLimitModal(false)}
            />

            <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış Ekranı Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Ürün Seçince Miktar Sor</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Aktif edilirse, ürün listesinden veya barkod ile ürün seçildiğinde miktar girmeniz için bir pencere açılır.
                            </p>
                        </div>

                        <button
                            onClick={toggleAskQuantity}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${askQuantity ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${askQuantity ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Satış Ekranındaki Kısayol Grup İsimleri</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satış ekranında görünen özel ürün grubu kategorilerini yönetin.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowShortcutModal(true)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors shadow-sm"
                        >
                            Grupları Yönet
                        </button>
                    </div>
                </div>
            </div>

            {/* Satış Ayarları / İptal Şifresi */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış ve İptal Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                        <div>
                            <h3 className="font-semibold text-red-800">Satışı İptal Etme Parolası</h3>
                            <p className="text-sm text-red-600 mt-1">
                                "Satış Detayı" ekranında satışı iptal etmek istediğinizde sorulacak parolayı belirleyin.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Parola:</span>
                            <input
                                type="text"
                                value={cancelPassword}
                                onChange={handlePasswordChange}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center font-mono w-32"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div>
                            <h3 className="font-semibold text-orange-800">Satış Detaylarını Değiştirme Parolası</h3>
                            <p className="text-sm text-orange-600 mt-1">
                                Geçmiş satışların detaylarını düzenlerken sorulacak parolayı belirleyin.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Parola:</span>
                            <input
                                type="text"
                                value={editSalePassword}
                                onChange={handleEditSalePasswordChange}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono w-32"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Satış Kartını Göster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satışlar sayfasındaki "Toplam Satış" bilgi kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowTotalSales}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showTotalSales ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showTotalSales ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Ciro Kartını Göster</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Satışlar sayfasındaki "Toplam Ciro" bilgi kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowTotalRevenue}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showTotalRevenue ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showTotalRevenue ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Fiş Ayarları Bölümü */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Satış Sonrası Fişi Ayarları
                </h2>

                <div className="space-y-4">
                    {/* Otomatik Yazdırma Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Satış Sonrası Fişi Otomatik Yazdırılsın</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Açık olduğunda her satış sonrası fiş otomatik olarak yazıcıya gönderilir.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                const newValue = !autoPrintReceipt;
                                setAutoPrintReceipt(newValue);
                                updateSetting('receipt_auto_print', newValue);
                                localStorage.setItem('receipt_auto_print', newValue.toString());
                            }}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${autoPrintReceipt ? 'bg-green-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${autoPrintReceipt ? 'translate-x-8' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Kağıt Boyutu Seçimi */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Kağıt Boyutu</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Yazdırılacak fiş için kullanılacak kağıt boyutunu seçin.
                            </p>
                        </div>
                        <select
                            value={receiptPaperSize}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setReceiptPaperSize(newValue);
                                updateSetting('receipt_paper_size', newValue);
                                localStorage.setItem('receipt_paper_size', newValue);
                            }}
                            className="px-4 py-2.5 bg-white border-2 border-blue-200 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-all"
                        >
                            <option value="Termal 80mm">Termal 80mm</option>
                            <option value="Termal 58mm">Termal 58mm</option>
                            <option value="A5 (148x210mm)">A5 (148x210mm)</option>
                            <option value="A4 (210x297mm)">A4 (210x297mm)</option>
                        </select>
                    </div>

                    {/* Fiş Tasarımcısı */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Fiş Görünümü Tasarla</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Seçili kağıt boyutu için fiş tasarımını özelleştirin.
                            </p>
                            <div className="flex gap-2 mt-2">
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Sürükle Bırak</span>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Canlı Önizleme</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Değişken Desteği</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowReceiptDesigner(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Tasarımcıyı Aç
                        </button>
                    </div>


                </div>
            </div>

            {/* Gelen Faturalar Ayarları */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Gelen Faturalar Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Toplam Tutar Görünümü</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Gelen Faturalar sayfasındaki toplam tutar kartını göster veya gizle.
                            </p>
                        </div>

                        <button
                            onClick={toggleShowInvoiceTotal}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showInvoiceTotal ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showInvoiceTotal ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Entegrasyon Ayarlari */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                    Entegrasyon Ayarları
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">BirFatura Entegrasyonu</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                E-Fatura ve E-Arşiv işlemleriniz için BirFatura API anahtarlarınızı yapılandırın.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowIntegrationModal(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-semibold text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                            </svg>
                            Ayarları Yapılandır
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Satışları BirFaturaya Sipariş Olarak Gönder</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Aktif edilirse, tamamlanan her satış otomatik olarak BirFatura sistemine sipariş olarak iletilir.
                            </p>
                        </div>

                        <button
                            onClick={toggleSendSalesToBirFatura}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${sendSalesToBirFatura ? 'bg-orange-500' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${sendSalesToBirFatura ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Secret Token Row */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200">
                        <div>
                            <h3 className="font-semibold text-gray-800">Sipariş Entegrasyon Token (Secret Token)</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Kayıtlı Token: <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                                    {secretToken.length > 20 ? secretToken.substring(0, 20) + '...' : secretToken}
                                </span>
                            </p>
                        </div>

                        <button
                            onClick={() => setShowSecretTokenModal(true)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Düzenle
                        </button>
                    </div>
                </div>
            </div>

            <ShortcutGroupsModal
                isOpen={showShortcutModal}
                onClose={() => setShowShortcutModal(false)}
            />

            <ReceiptDesignerModal
                isOpen={showReceiptDesigner}
                onClose={() => setShowReceiptDesigner(false)}
                initialPaperSize={receiptPaperSize}
            />

            <IntegrationSettingsModal
                isOpen={showIntegrationModal}
                onClose={() => setShowIntegrationModal(false)}
            />

            <SecretTokenModal
                isOpen={showSecretTokenModal}
                onClose={() => {
                    setShowSecretTokenModal(false);
                    loadSettings();
                }}
            />

            <CompanyInfoModal
                isOpen={showCompanyInfoModal}
                onClose={() => setShowCompanyInfoModal(false)}
            />

            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal(prev => ({...prev, isOpen: false}))}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />
        </div>
    );
}
