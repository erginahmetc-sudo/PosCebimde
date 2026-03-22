import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// Lisans anahtarı üretici: XXXX-XXXX-XXXX-XXXX
function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

// ============================================================
// Süper Admin — Lisans Yönetim Paneli
// ============================================================

function LicenseFormModal({ onClose, onSave, initial }) {
    const [form, setForm] = useState({
        company_code: initial?.company_code || '',
        company_name: initial?.company_name || '',
        max_users: initial?.max_users || 1,
        expires_at: initial?.expires_at ? initial.expires_at.slice(0, 10) : '',
        notes: initial?.notes || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isEdit = !!initial;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.company_code.trim()) { setError('Şirket kodu zorunlu'); return; }
        setSaving(true);
        setError('');
        try {
            await onSave({
                ...form,
                max_users: parseInt(form.max_users) || 1,
                expires_at: form.expires_at || null,
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Bir hata oluştu');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEdit ? '✏️ Lisans Düzenle' : '➕ Yeni Lisans Oluştur'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">ŞİRKET KODU *</label>
                        <input
                            type="text"
                            value={form.company_code}
                            onChange={e => setForm(f => ({ ...f, company_code: e.target.value.toUpperCase() }))}
                            placeholder="ORN: AHMET2024"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isEdit}
                        />
                        {isEdit && <p className="text-xs text-gray-400 mt-1">Şirket kodu düzenlenemez</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">MÜŞTERİ / İŞLETME ADI</label>
                        <input
                            type="text"
                            value={form.company_name}
                            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                            placeholder="Ahmet'in Marketi"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">KULLANICI SAYISI SINIRI</label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={form.max_users}
                            onChange={e => setForm(f => ({ ...f, max_users: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Kaç farklı bilgisayarda kullanılabilir</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">KULLANIM BİTİŞ TARİHİ</label>
                        <input
                            type="date"
                            value={form.expires_at}
                            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Boş bırakılırsa süresiz geçerli</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">NOTLAR</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Müşteri hakkında notlar..."
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                            ❌ {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? '⏳ Kaydediliyor...' : isEdit ? '💾 Güncelle' : '✅ Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Lisans durumu badge
function StatusBadge({ license }) {
    const now = new Date();
    const expired = license.expires_at && new Date(license.expires_at) < now;

    if (!license.is_active) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            ⏸ Pasif
        </span>
    );
    if (expired) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            ⏰ Süresi Dolmuş
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            ✅ Aktif
        </span>
    );
}

export default function AdminLicensesPage() {
    const { isSuperAdmin } = useAuth();
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all | active | passive | expired
    const [showModal, setShowModal] = useState(false);
    const [editingLicense, setEditingLicense] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const [toast, setToast] = useState(null);

    const loadLicenses = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Tüm kurucu (founder) profilleri çek
            const { data: founders, error: foundersError } = await supabase
                .from('user_profiles')
                .select('id, username, company_code, email')
                .eq('role', 'kurucu');

            if (foundersError) console.warn('Kurucu fetch warning:', foundersError.message);

            // 2. Mevcut lisansları çek
            const { data: existingLicenses, error: licError } = await supabase
                .from('licenses')
                .select('*')
                .order('created_at', { ascending: false });
            if (licError) throw licError;

            // 3. Lisansı olmayan kurucu üyeler için otomatik oluştur
            const licensedCodes = new Set((existingLicenses || []).map(l => l.company_code));
            const todayISO = new Date().toISOString().slice(0, 10);
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

            const newLicenses = [];
            for (const founder of (founders || [])) {
                if (!founder.company_code || licensedCodes.has(founder.company_code)) continue;
                const autoKey = `${seg()}-${seg()}-${seg()}-${seg()}`;
                // Supabase auth.users'tan email çek (user_profiles'ta olmayabilir)
                let ownerEmail = founder.email || null;
                if (!ownerEmail) {
                    try {
                        const { data: authUser } = await supabase.auth.admin?.getUserById?.(founder.id) || {};
                        ownerEmail = authUser?.user?.email || null;
                    } catch (_) { /* ignore */ }
                }
                const { data: newLic, error: newLicErr } = await supabase
                    .from('licenses')
                    .insert({
                        license_key: autoKey,
                        company_code: founder.company_code,
                        company_name: founder.username || founder.company_code,
                        owner_email: ownerEmail,
                        max_users: 1,
                        expires_at: todayISO,
                        is_active: true,
                        notes: 'Otomatik oluşturuldu — Mevcut kurucu üyelik',
                    })
                    .select()
                    .single();
                if (newLicErr) {
                    console.error('Admin sync license err:', newLicErr);
                    showToast('Otomatik lisans oluşturulamadı: ' + newLicErr.message, 'error');
                } else if (newLic) {
                    newLicenses.push(newLic);
                    licensedCodes.add(founder.company_code);
                }
            }

            // 4. Email bilgisini lisanslara birleştir (owner_email alanından ya da user_profiles'tan)
            const emailMap = {};
            for (const f of (founders || [])) {
                if (f.company_code) emailMap[f.company_code] = f.email || null;
            }

            const allLicenses = [...newLicenses, ...(existingLicenses || [])].map(l => ({
                ...l,
                owner_email: l.owner_email || emailMap[l.company_code] || null,
            }));

            // Deduplicate by id, sort by created_at desc
            const seen = new Set();
            const deduped = allLicenses.filter(l => {
                if (seen.has(l.id)) return false;
                seen.add(l.id);
                return true;
            }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setLicenses(deduped);
        } catch (err) {
            showToast('Lisanslar yüklenemedi: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadLicenses(); }, [loadLicenses]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleCreate = async (form) => {
        const license_key = generateLicenseKey();
        const { data, error } = await supabase
            .from('licenses')
            .insert({
                license_key,
                company_code: form.company_code,
                company_name: form.company_name || form.company_code,
                max_users: parseInt(form.max_users) || 1,
                expires_at: form.expires_at || null,
                notes: form.notes || null,
                is_active: true,
            })
            .select()
            .single();
        if (error) throw error;
        setLicenses(prev => [data, ...prev]);
        showToast(`✅ Lisans oluşturuldu: ${data.license_key}`);
    };

    const handleUpdate = async (form) => {
        const { data, error } = await supabase
            .from('licenses')
            .update({
                company_name: form.company_name,
                max_users: parseInt(form.max_users) || 1,
                expires_at: form.expires_at || null,
                notes: form.notes || null,
            })
            .eq('id', editingLicense.id)
            .select()
            .single();
        if (error) throw error;
        setLicenses(prev => prev.map(l => l.id === data.id ? data : l));
        showToast('💾 Lisans güncellendi');
    };

    const handleToggleActive = async (license) => {
        try {
            const { data, error } = await supabase
                .from('licenses')
                .update({ is_active: !license.is_active })
                .eq('id', license.id)
                .select()
                .single();
            if (error) throw error;
            setLicenses(prev => prev.map(l => l.id === data.id ? data : l));
            showToast(data.is_active ? '✅ Lisans aktif edildi' : '⏸ Lisans pasife alındı');
        } catch (err) {
            showToast('Hata: ' + err.message, 'error');
        }
    };

    const handleDelete = async (license) => {
        if (!window.confirm(`"${license.company_name || license.company_code}" lisansını silmek istediğinizden emin misiniz?\n\nAnahtar: ${license.license_key}`)) return;
        try {
            const { error } = await supabase
                .from('licenses')
                .delete()
                .eq('id', license.id);
            if (error) throw error;
            setLicenses(prev => prev.filter(l => l.id !== license.id));
            showToast('🗑 Lisans silindi');
        } catch (err) {
            showToast('Hata: ' + err.message, 'error');
        }
    };

    const copyToClipboard = (key) => {
        navigator.clipboard.writeText(key).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    // Filtreleme
    const filtered = licenses.filter(l => {
        const now = new Date();
        const expired = l.expires_at && new Date(l.expires_at) < now;
        const matchSearch = !search ||
            l.license_key?.toLowerCase().includes(search.toLowerCase()) ||
            l.company_code?.toLowerCase().includes(search.toLowerCase()) ||
            l.company_name?.toLowerCase().includes(search.toLowerCase()) ||
            l.owner_email?.toLowerCase().includes(search.toLowerCase());

        if (!matchSearch) return false;
        if (filter === 'active') return l.is_active && !expired;
        if (filter === 'passive') return !l.is_active;
        if (filter === 'expired') return expired;
        return true;
    });

    // Özet istatistikler
    const stats = {
        total: licenses.length,
        active: licenses.filter(l => l.is_active && !(l.expires_at && new Date(l.expires_at) < new Date())).length,
        passive: licenses.filter(l => !l.is_active).length,
        expired: licenses.filter(l => l.expires_at && new Date(l.expires_at) < new Date()).length,
    };

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Erişim Engellendi</h1>
                    <p className="text-gray-500">Bu sayfa yalnızca süper adminlere açıktır.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all
                    ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
                    {toast.msg}
                </div>
            )}

            <div className="max-w-6xl mx-auto p-4 md:p-6">
                {/* Başlık */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            🔑 Lisans Yönetim Paneli
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">Masaüstü uygulama lisanslarını buradan yönetin</p>
                    </div>
                    <button
                        onClick={() => { setEditingLicense(null); setShowModal(true); }}
                        className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                    >
                        ➕ Yeni Lisans
                    </button>
                </div>

                {/* İstatistik Kartları */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Toplam', value: stats.total, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
                        { label: 'Aktif', value: stats.active, color: 'bg-green-50 text-green-700', border: 'border-green-200' },
                        { label: 'Pasif', value: stats.passive, color: 'bg-gray-50 text-gray-600', border: 'border-gray-200' },
                        { label: 'Süresi Dolmuş', value: stats.expired, color: 'bg-red-50 text-red-600', border: 'border-red-200' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} border ${s.border} rounded-xl p-4 text-center`}>
                            <div className="text-2xl font-bold">{s.value}</div>
                            <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Arama & Filtre */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Anahtar, şirket kodu veya ad ile ara..."
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        {[
                            { key: 'all', label: 'Tümü' },
                            { key: 'active', label: 'Aktif' },
                            { key: 'passive', label: 'Pasif' },
                            { key: 'expired', label: 'Dolmuş' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors
                                    ${filter === f.key
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lisans Tablosu */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="py-16 text-center text-gray-400">
                            <div className="text-3xl mb-2 animate-pulse">⏳</div>
                            <p>Yükleniyor...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">
                            <div className="text-4xl mb-2">🔑</div>
                            <p className="font-medium">Lisans bulunamadı</p>
                            <p className="text-sm mt-1">Yeni bir lisans oluşturun</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lisans Anahtarı</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Müşteri</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-posta</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kullanıcı</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bitiş Tarihi</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Durum</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map(license => (
                                        <tr key={license.id} className="hover:bg-gray-50 transition-colors">
                                            {/* Anahtar */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-semibold text-gray-800 tracking-wider">
                                                        {license.license_key}
                                                    </span>
                                                    <button
                                                        onClick={() => copyToClipboard(license.license_key)}
                                                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors
                                                            ${copiedKey === license.license_key
                                                                ? 'bg-green-100 text-green-600 border-green-300'
                                                                : 'text-gray-400 border-gray-300 hover:text-blue-600 hover:border-blue-300'}`}
                                                        title="Kopyala"
                                                    >
                                                        {copiedKey === license.license_key ? '✓' : '⎘'}
                                                    </button>
                                                </div>
                                            </td>
                                            {/* Müşteri */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800">{license.company_name || '—'}</div>
                                                <div className="text-xs text-gray-400 font-mono">{license.company_code}</div>
                                            </td>
                                            {/* E-posta */}
                                            <td className="px-4 py-3">
                                                {license.owner_email ? (
                                                    <span className="text-sm text-blue-600 font-mono">{license.owner_email}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-300">—</span>
                                                )}
                                            </td>
                                            {/* Kullanıcı limiti */}
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                                                    💻 {license.max_users} bilgisayar
                                                </span>
                                            </td>
                                            {/* Bitiş tarihi */}
                                            <td className="px-4 py-3">
                                                {license.expires_at ? (
                                                    <span className={`text-sm ${new Date(license.expires_at) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-600'}`}>
                                                        {new Date(license.expires_at).toLocaleDateString('tr-TR')}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-green-600 font-medium">♾ Süresiz</span>
                                                )}
                                            </td>
                                            {/* Durum */}
                                            <td className="px-4 py-3">
                                                <StatusBadge license={license} />
                                            </td>
                                            {/* İşlemler */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => { setEditingLicense(license); setShowModal(true); }}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Düzenle"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(license)}
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            license.is_active
                                                                ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                                                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                        title={license.is_active ? 'Pasife Al' : 'Aktif Et'}
                                                    >
                                                        {license.is_active ? '⏸' : '▶️'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(license)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Sil"
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Toplam */}
                {!loading && filtered.length > 0 && (
                    <p className="text-xs text-gray-400 mt-3 text-right">
                        {filtered.length} / {licenses.length} lisans gösteriliyor
                    </p>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <LicenseFormModal
                    initial={editingLicense}
                    onClose={() => { setShowModal(false); setEditingLicense(null); }}
                    onSave={editingLicense ? handleUpdate : handleCreate}
                />
            )}
        </div>
    );
}
