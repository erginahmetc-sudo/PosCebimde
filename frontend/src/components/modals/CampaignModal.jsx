import { useState, useEffect, useMemo } from 'react';
import { productsAPI, customersAPI } from '../../services/api';

const DEFAULT_TIER = () => ({ min_qty: 1, max_qty: '', discount_rate: '' });

export default function CampaignModal({ campaign, onSave, onClose }) {
    const isEdit = !!campaign;

    // Form state
    const [name, setName] = useState(campaign?.name || '');
    const [isActive, setIsActive] = useState(campaign?.is_active ?? true);

    // Tiers state — array of { min_qty, max_qty, discount_rate }
    const [tiers, setTiers] = useState(() => {
        if (campaign?.tiers && campaign.tiers.length > 0) return campaign.tiers;
        return [DEFAULT_TIER()];
    });

    // Product selection state
    const [allProducts, setAllProducts] = useState([]);
    const [selectedProductCodes, setSelectedProductCodes] = useState(campaign?.product_codes || []);
    const [productNameFilter, setProductNameFilter] = useState('');
    const [productGroupFilter, setProductGroupFilter] = useState('Tümü');
    const [productGroups, setProductGroups] = useState(['Tümü']);

    // Customer selection state
    const [allCustomers, setAllCustomers] = useState([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState(campaign?.customer_ids || []);
    const [customerSearch, setCustomerSearch] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('tiers'); // 'tiers' | 'products' | 'customers'

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [prodRes, custRes] = await Promise.all([
                    productsAPI.getAll(),
                    customersAPI.getAll()
                ]);
                const prods = prodRes.data?.products || [];
                setAllProducts(prods);
                const groups = ['Tümü', ...new Set(prods.map(p => p.group).filter(Boolean))];
                setProductGroups(groups);
                setAllCustomers(custRes.data?.customers || []);
            } catch (e) {
                console.error('Load error', e);
            }
            setLoading(false);
        };
        load();
    }, []);

    const filteredProducts = useMemo(() => {
        return allProducts.filter(p => {
            const matchesName = !productNameFilter ||
                p.name?.toLowerCase().includes(productNameFilter.toLowerCase()) ||
                p.stock_code?.toLowerCase().includes(productNameFilter.toLowerCase());
            const matchesGroup = productGroupFilter === 'Tümü' || p.group === productGroupFilter;
            return matchesName && matchesGroup;
        });
    }, [allProducts, productNameFilter, productGroupFilter]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return allCustomers;
        const q = customerSearch.toLowerCase();
        return allCustomers.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q) ||
            c.customer_code?.toLowerCase().includes(q)
        );
    }, [allCustomers, customerSearch]);

    // ── Tier helpers ──────────────────────────────────────────────
    const addTier = () => setTiers(prev => [...prev, DEFAULT_TIER()]);

    const removeTier = (idx) => setTiers(prev => prev.filter((_, i) => i !== idx));

    const updateTier = (idx, field, value) => {
        setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    };

    // Auto-fill min_qty of next tier when max_qty is set
    const handleMaxQtyChange = (idx, value) => {
        updateTier(idx, 'max_qty', value);
        // Auto-set next tier's min_qty = this max_qty + 1
        if (value && tiers[idx + 1] !== undefined) {
            const next = parseInt(value) + 1;
            setTiers(prev => prev.map((t, i) => i === idx + 1 ? { ...t, min_qty: next } : t));
        }
    };

    // ── Product helpers ──────────────────────────────────────────
    const toggleProduct = (stockCode) => {
        setSelectedProductCodes(prev =>
            prev.includes(stockCode) ? prev.filter(sc => sc !== stockCode) : [...prev, stockCode]
        );
    };

    const addAllFiltered = () => {
        const codes = filteredProducts.map(p => p.stock_code);
        setSelectedProductCodes(prev => [...new Set([...prev, ...codes])]);
    };

    // ── Customer helpers ─────────────────────────────────────────
    const toggleCustomer = (id) => {
        setSelectedCustomerIds(prev =>
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    const selectAllCustomers = () => {
        const ids = filteredCustomers.map(c => c.id);
        setSelectedCustomerIds(prev => [...new Set([...prev, ...ids])]);
    };

    // ── Validation & Submit ──────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return alert('Kampanya adı zorunludur.');
        if (selectedProductCodes.length === 0) return alert('En az 1 ürün seçiniz.');

        // Validate tiers
        for (let i = 0; i < tiers.length; i++) {
            const t = tiers[i];
            if (!t.min_qty || isNaN(t.min_qty) || t.min_qty < 1)
                return alert(`${i + 1}. kademede geçerli bir minimum adet giriniz.`);
            if (!t.discount_rate || isNaN(t.discount_rate) || t.discount_rate <= 0 || t.discount_rate > 100)
                return alert(`${i + 1}. kademede geçerli bir iskonto oranı giriniz (1-100).`);
        }

        const cleanTiers = tiers.map(t => ({
            min_qty: parseInt(t.min_qty),
            max_qty: t.max_qty ? parseInt(t.max_qty) : null,
            discount_rate: parseFloat(t.discount_rate),
        }));

        setSaving(true);
        try {
            await onSave({
                name: name.trim(),
                tiers: cleanTiers,
                is_active: isActive,
                product_codes: selectedProductCodes,
                customer_ids: selectedCustomerIds,
            });
        } finally {
            setSaving(false);
        }
    };

    const tabClass = (t) =>
        `flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${activeTab === t
            ? 'border-purple-600 text-purple-600'
            : 'border-transparent text-slate-400 hover:text-slate-700'}`;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-xl">local_offer</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{isEdit ? 'Kampanya Düzenle' : 'Yeni Kampanya Ekle'}</h2>
                            <p className="text-white/70 text-xs">Kademeli iskonto oranları belirleyin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">

                    {/* ── Campaign Name + Active ── */}
                    <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kampanya Adı *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="örn. Yaz İndirimi 2025"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                    required
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${isActive
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                {isActive ? 'Aktif' : 'Pasif'}
                            </button>
                        </div>
                    </div>

                    {/* ── Tab Switcher ── */}
                    <div className="flex border-b border-slate-200 flex-shrink-0 px-6 bg-white">
                        <button type="button" onClick={() => setActiveTab('tiers')} className={tabClass('tiers')}>
                            <span className="material-symbols-outlined text-base">layers</span>
                            İskonto Kademeleri
                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{tiers.length}</span>
                        </button>
                        <button type="button" onClick={() => setActiveTab('products')} className={tabClass('products')}>
                            <span className="material-symbols-outlined text-base">inventory_2</span>
                            Kampanya Ürünleri
                            {selectedProductCodes.length > 0 && (
                                <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{selectedProductCodes.length}</span>
                            )}
                        </button>
                        <button type="button" onClick={() => setActiveTab('customers')} className={tabClass('customers')}>
                            <span className="material-symbols-outlined text-base">groups</span>
                            Dahil Müşteriler
                            {selectedCustomerIds.length > 0 && (
                                <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{selectedCustomerIds.length}</span>
                            )}
                        </button>
                    </div>

                    {/* ── Tab Content ── */}
                    <div className="flex-1 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-3xl mr-2">progress_activity</span>
                                Yükleniyor...
                            </div>

                        ) : activeTab === 'tiers' ? (
                            /* ── TIERS TAB ── */
                            <div className="p-6 overflow-y-auto h-full">
                                <div className="max-w-2xl mx-auto">
                                    <p className="text-sm text-slate-500 mb-5 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                                        <span className="material-symbols-outlined text-blue-500 text-lg flex-shrink-0 mt-0.5">info</span>
                                        Sepette bu kampanyanın ürünlerinden kaç adet olduğuna göre en yüksek uygun kademedeki iskonto otomatik uygulanır.
                                    </p>

                                    {/* Tier rows */}
                                    <div className="space-y-3">
                                        {tiers.map((tier, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-purple-300 transition-colors group"
                                            >
                                                {/* Kademe badge */}
                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-extrabold">
                                                    {idx + 1}
                                                </div>

                                                {/* Min qty */}
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Min. Adet</label>
                                                    <input
                                                        type="number"
                                                        value={tier.min_qty}
                                                        onChange={e => updateTier(idx, 'min_qty', e.target.value)}
                                                        min="1"
                                                        placeholder="1"
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                                                    />
                                                </div>

                                                <div className="flex-shrink-0 text-slate-300 text-lg font-light mt-4">—</div>

                                                {/* Max qty */}
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Max. Adet <span className="text-slate-300 font-normal">(boş = sınırsız)</span></label>
                                                    <input
                                                        type="number"
                                                        value={tier.max_qty}
                                                        onChange={e => handleMaxQtyChange(idx, e.target.value)}
                                                        min={tier.min_qty || 1}
                                                        placeholder="∞"
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                                                    />
                                                </div>

                                                <div className="flex-shrink-0 text-slate-300 mt-4">→</div>

                                                {/* Discount rate */}
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">İskonto Oranı</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={tier.discount_rate}
                                                            onChange={e => updateTier(idx, 'discount_rate', e.target.value)}
                                                            min="0.01"
                                                            max="100"
                                                            step="0.01"
                                                            placeholder="0"
                                                            className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 font-bold text-purple-700"
                                                        />
                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                                                    </div>
                                                </div>

                                                {/* Remove button */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTier(idx)}
                                                    disabled={tiers.length === 1}
                                                    className="flex-shrink-0 w-8 h-8 mt-4 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <span className="material-symbols-outlined text-lg">remove_circle</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Tier button */}
                                    <button
                                        type="button"
                                        onClick={addTier}
                                        className="mt-4 w-full py-3 border-2 border-dashed border-purple-200 rounded-xl text-purple-600 text-sm font-semibold hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">add_circle</span>
                                        Yeni Kademe Ekle
                                    </button>

                                    {/* Tier Preview */}
                                    {tiers.some(t => t.min_qty && t.discount_rate) && (
                                        <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                                            <p className="text-xs font-bold text-purple-700 uppercase mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm">preview</span>
                                                Önizleme
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {tiers.filter(t => t.min_qty && t.discount_rate).map((t, i) => (
                                                    <div key={i} className="bg-white rounded-lg px-3 py-2 border border-purple-200 text-xs font-semibold text-slate-700 flex items-center gap-2">
                                                        <span className="text-slate-500">
                                                            {t.min_qty}{t.max_qty ? `–${t.max_qty}` : '+'} adet
                                                        </span>
                                                        <span className="text-purple-600 font-extrabold">→ %{t.discount_rate}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        ) : activeTab === 'products' ? (
                            /* ── PRODUCTS TAB ── */
                            <div className="flex h-full">
                                {/* Filter Sidebar */}
                                <div className="w-56 border-r border-slate-100 p-4 flex flex-col gap-3 flex-shrink-0 bg-slate-50/50">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ürün Ara</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                            <input
                                                type="text"
                                                value={productNameFilter}
                                                onChange={e => setProductNameFilter(e.target.value)}
                                                placeholder="İsim / Kod"
                                                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Grup</label>
                                        <select
                                            value={productGroupFilter}
                                            onChange={e => setProductGroupFilter(e.target.value)}
                                            className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                        >
                                            {productGroups.map(g => <option key={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setProductNameFilter(''); setProductGroupFilter('Tümü'); }}
                                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                                    >
                                        <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                                        Filtreyi Temizle
                                    </button>
                                    <div className="border-t border-slate-200 pt-3">
                                        <button
                                            type="button"
                                            onClick={addAllFiltered}
                                            className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-sm">playlist_add</span>
                                            Tümünü Ekle ({filteredProducts.length})
                                        </button>
                                        {selectedProductCodes.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedProductCodes([])}
                                                className="w-full mt-2 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined text-sm">remove_done</span>
                                                Seçimi Temizle
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 text-center">
                                        <span className="font-bold text-purple-600">{selectedProductCodes.length}</span> ürün seçildi
                                    </div>
                                </div>

                                {/* Product List */}
                                <div className="flex-1 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase w-10"></th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Stok Kodu</th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Ürün Adı</th>
                                                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Fiyat</th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Grup</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredProducts.map(p => {
                                                const isSelected = selectedProductCodes.includes(p.stock_code);
                                                return (
                                                    <tr
                                                        key={p.stock_code}
                                                        onClick={() => toggleProduct(p.stock_code)}
                                                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <td className="px-3 py-2">
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                                {isSelected && <span className="material-symbols-outlined text-white text-xs">check</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 font-mono">{p.stock_code}</td>
                                                        <td className="px-3 py-2 font-medium text-slate-800 text-sm">{p.name}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-red-600 text-sm">{p.price?.toFixed(2)} ₺</td>
                                                        <td className="px-3 py-2 text-xs text-slate-400">{p.group || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredProducts.length === 0 && (
                                                <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Ürün bulunamadı</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        ) : (
                            /* ── CUSTOMERS TAB ── */
                            <div className="flex h-full">
                                <div className="w-56 border-r border-slate-100 p-4 flex flex-col gap-3 flex-shrink-0 bg-slate-50/50">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Müşteri Ara</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                            <input
                                                type="text"
                                                value={customerSearch}
                                                onChange={e => setCustomerSearch(e.target.value)}
                                                placeholder="İsim / Firma / Kod"
                                                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3">
                                        <button
                                            type="button"
                                            onClick={selectAllCustomers}
                                            className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-sm">group_add</span>
                                            Tümünü Ekle ({filteredCustomers.length})
                                        </button>
                                        {selectedCustomerIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCustomerIds([])}
                                                className="w-full mt-2 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined text-sm">person_remove</span>
                                                Seçimi Temizle
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 text-center">
                                        <span className="font-bold text-purple-600">{selectedCustomerIds.length}</span> müşteri seçildi
                                    </div>
                                    <p className="text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                                        💡 Hiç müşteri seçilmezse tüm müşterilere uygulanır
                                    </p>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase w-10"></th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Kod</th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Kısa Ad</th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Firma</th>
                                                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Grup</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredCustomers.map(c => {
                                                const isSelected = selectedCustomerIds.includes(c.id);
                                                return (
                                                    <tr
                                                        key={c.id}
                                                        onClick={() => toggleCustomer(c.id)}
                                                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-slate-50'}`}
                                                    >
                                                        <td className="px-3 py-2">
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                                {isSelected && <span className="material-symbols-outlined text-white text-xs">check</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 font-mono">{c.customer_code || '-'}</td>
                                                        <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                                                        <td className="px-3 py-2 text-slate-500 text-xs">{c.company || '-'}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-400">{c.group || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredCustomers.length === 0 && (
                                                <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Müşteri bulunamadı</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-purple-500">layers</span>
                                <strong className="text-slate-700">{tiers.length}</strong> kademe
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-purple-500">inventory_2</span>
                                <strong className="text-slate-700">{selectedProductCodes.length}</strong> ürün
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-purple-500">groups</span>
                                <strong className="text-slate-700">{selectedCustomerIds.length === 0 ? 'Tümü' : selectedCustomerIds.length}</strong> müşteri
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors">
                                İptal
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                {saving
                                    ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Kaydediliyor...</>
                                    : <><span className="material-symbols-outlined text-sm">save</span>{isEdit ? 'Güncelle' : 'Kampanyayı Kaydet'}</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
