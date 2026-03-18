import { useState, useEffect } from 'react';
import { campaignsAPI, productsAPI, customersAPI } from '../services/api';
import CampaignModal from '../components/modals/CampaignModal';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]);
    const [toastMsg, setToastMsg] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [campRes, prodRes, custRes] = await Promise.all([
                campaignsAPI.getAll(),
                productsAPI.getAll(),
                customersAPI.getAll(),
            ]);
            setCampaigns(campRes.data?.campaigns || []);
            setAllProducts(prodRes.data?.products || []);
            setAllCustomers(custRes.data?.customers || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (data) => {
        try {
            if (editingCampaign) {
                await campaignsAPI.update(editingCampaign.id, data);
                showToast('Kampanya güncellendi.');
            } else {
                await campaignsAPI.add(data);
                showToast('Kampanya oluşturuldu.');
            }
            setShowModal(false);
            setEditingCampaign(null);
            load();
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Bir hata oluştu.';
            console.error('Campaign save error:', e);
            showToast(msg, 'error');
        }
    };

    const handleDelete = async (campaign) => {
        if (!confirm(`"${campaign.name}" kampanyasını silmek istediğinize emin misiniz?`)) return;
        try {
            await campaignsAPI.delete(campaign.id);
            showToast('Kampanya silindi.');
            load();
        } catch (e) {
            showToast('Silme işlemi başarısız.', 'error');
        }
    };

    const handleToggle = async (campaign) => {
        try {
            await campaignsAPI.toggleActive(campaign.id, !campaign.is_active);
            showToast(campaign.is_active ? 'Kampanya pasife alındı.' : 'Kampanya aktif edildi.');
            load();
        } catch (e) {
            showToast('Güncelleme başarısız.', 'error');
        }
    };

    const handleEdit = (campaign) => {
        setEditingCampaign(campaign);
        setShowModal(true);
    };

    const getProductNames = (codes) => {
        if (!codes || codes.length === 0) return [];
        return allProducts
            .filter(p => codes.includes(p.stock_code))
            .map(p => p.name)
            .slice(0, 3);
    };

    const getCustomerNames = (ids) => {
        if (!ids || ids.length === 0) return [];
        return allCustomers
            .filter(c => ids.includes(c.id))
            .map(c => c.name)
            .slice(0, 3);
    };

    const activeCampaigns = campaigns.filter(c => c.is_active);
    const passiveCampaigns = campaigns.filter(c => !c.is_active);

    return (
        <div className="min-h-full">
            {/* Toast */}
            {toastMsg && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold transition-all ${toastMsg.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    <span className="material-symbols-outlined text-lg">{toastMsg.type === 'error' ? 'error' : 'check_circle'}</span>
                    {toastMsg.msg}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-5 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <span className="material-symbols-outlined text-white text-2xl">local_offer</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kampanyalar</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Ürün bazlı iskonto kampanyalarını yönetin</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingCampaign(null); setShowModal(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all shadow-md shadow-purple-500/30"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Kampanya Ekle
                    </button>
                </div>
            </div>

            <div className="px-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Toplam</span>
                            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-purple-600 text-xl">local_offer</span>
                            </div>
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900">{campaigns.length}</p>
                        <p className="text-xs text-slate-400 mt-1">kampanya</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Aktif</span>
                            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
                            </div>
                        </div>
                        <p className="text-3xl font-extrabold text-emerald-600">{activeCampaigns.length}</p>
                        <p className="text-xs text-slate-400 mt-1">çalışıyor</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Pasif</span>
                            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-400 text-xl">pause_circle</span>
                            </div>
                        </div>
                        <p className="text-3xl font-extrabold text-slate-500">{passiveCampaigns.length}</p>
                        <p className="text-xs text-slate-400 mt-1">beklemede</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Toplam Kademe</span>
                            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-600 text-xl">layers</span>
                            </div>
                        </div>
                        <p className="text-3xl font-extrabold text-amber-600">
                            {campaigns.reduce((s, c) => s + (c.tiers?.length || 0), 0)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">iskonto kademesi</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined animate-spin text-3xl mr-2">progress_activity</span>
                        Yükleniyor...
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-purple-300 text-4xl">local_offer</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Henüz kampanya yok</h3>
                        <p className="text-slate-400 text-sm mb-6">İlk kampanyanızı oluşturmak için "Kampanya Ekle" butonuna tıklayın.</p>
                        <button
                            onClick={() => { setEditingCampaign(null); setShowModal(true); }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all shadow-md"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Kampanya Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-8">
                        {campaigns.map(campaign => {
                            const productNames = getProductNames(campaign.product_codes);
                            const customerNames = getCustomerNames(campaign.customer_ids);
                            const extraProducts = (campaign.product_codes?.length || 0) - productNames.length;
                            const extraCustomers = (campaign.customer_ids?.length || 0) - customerNames.length;

                            return (
                                <div
                                    key={campaign.id}
                                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden group ${campaign.is_active ? 'border-purple-100' : 'border-slate-100 opacity-70'}`}
                                >
                                    {/* Card Header */}
                                    <div className={`px-5 py-4 ${campaign.is_active ? 'bg-gradient-to-r from-purple-50 to-violet-50' : 'bg-slate-50'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-900 text-base truncate">{campaign.name}</h3>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${campaign.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${campaign.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                        {campaign.is_active ? 'Aktif' : 'Pasif'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">layers</span>
                                                        {campaign.tiers?.length || 0} kademe
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center ${campaign.is_active ? 'bg-purple-600' : 'bg-slate-400'} shadow-md`}>
                                                <span className="text-white font-extrabold text-lg leading-none">
                                                    %{campaign.tiers?.length > 0 ? Math.max(...campaign.tiers.map(t => t.discount_rate)) : 0}
                                                </span>
                                                <span className="text-white/80 text-[10px] font-semibold mt-0.5">Maks.</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="px-5 py-3 space-y-3">
                                        {/* Tiers */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <span className="material-symbols-outlined text-sm text-purple-500">layers</span>
                                                <span className="text-xs font-bold text-slate-500 uppercase">İskonto Kademeleri</span>
                                            </div>
                                            {campaign.tiers?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {campaign.tiers.map((t, i) => (
                                                        <span key={i} className="text-xs bg-purple-50 text-purple-800 px-2 py-1 rounded-lg font-semibold border border-purple-100 flex items-center gap-1">
                                                            <span className="text-slate-500 font-normal">
                                                                {t.min_qty}{t.max_qty ? `–${t.max_qty}` : '+'} adet
                                                            </span>
                                                            <span className="text-purple-600 font-extrabold">%{t.discount_rate}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Kademe tanımlanmamış</span>
                                            )}
                                        </div>

                                        {/* Products */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <span className="material-symbols-outlined text-sm text-indigo-500">inventory_2</span>
                                                <span className="text-xs font-bold text-slate-500 uppercase">Ürünler ({campaign.product_codes?.length || 0})</span>
                                            </div>
                                            {productNames.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {productNames.map((name, i) => (
                                                        <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-medium">{name}</span>
                                                    ))}
                                                    {extraProducts > 0 && (
                                                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-medium">+{extraProducts} daha</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Ürün seçilmemiş</span>
                                            )}
                                        </div>

                                        {/* Customers */}
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <span className="material-symbols-outlined text-sm text-violet-500">groups</span>
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    Müşteriler ({campaign.customer_ids?.length === 0 ? 'Tümü' : campaign.customer_ids?.length || 0})
                                                </span>
                                            </div>
                                            {campaign.customer_ids?.length === 0 ? (
                                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-medium">Tüm müşteriler</span>
                                            ) : customerNames.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {customerNames.map((name, i) => (
                                                        <span key={i} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-lg font-medium">{name}</span>
                                                    ))}
                                                    {extraCustomers > 0 && (
                                                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-medium">+{extraCustomers} daha</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">—</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Actions */}
                                    <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggle(campaign)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${campaign.is_active
                                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-sm">{campaign.is_active ? 'pause' : 'play_arrow'}</span>
                                            {campaign.is_active ? 'Pasife Al' : 'Aktif Et'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(campaign)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                            Düzenle
                                        </button>
                                        <button
                                            onClick={() => handleDelete(campaign)}
                                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <CampaignModal
                    campaign={editingCampaign}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditingCampaign(null); }}
                />
            )}
        </div>
    );
}
