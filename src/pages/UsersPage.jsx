import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

import StatusModal from '../components/modals/StatusModal';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPermModal, setShowPermModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'error' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        role: 'calisan',
    });
    const [permissions, setPermissions] = useState({});
    const [schedule, setSchedule] = useState({
        days: [],
        start_time: '00:00',
        end_time: '23:59'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { isKurucu, user: currentUser } = useAuth();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await usersAPI.getAll();
            setUsers(response.data?.users || response.data || []);
        } catch (error) {
            console.error('Kullanıcılar yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setIsEditMode(false);
        setEditingUserId(null);
        setFormData({
            username: '',
            password: '',
            email: '',
            role: 'calisan',
        });
        setPermissions({});
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setIsEditMode(true);
        setEditingUserId(user.id);
        setFormData({
            username: user.username,
            password: '', // Leave empty to keep unchanged
            email: user.email || '',
            role: user.role,
        });
        setPermissions(user.permissions || {});
        setShowModal(true);
    };

    const openPermModal = (user) => {
        setSelectedUser(user);
        setPermissions(user.permissions || {});
        setShowPermModal(true);
    };

    const openScheduleModal = (user) => {
        setSelectedUser(user);
        setSchedule(user.access_schedule || {
            days: [],
            start_time: '00:00',
            end_time: '23:59'
        });
        setShowScheduleModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const userData = {
                ...formData,
                permissions: permissions
            };

            if (isEditMode) {
                // Update
                await usersAPI.update(editingUserId, userData);
                // Password update handled separately if not empty
                if (formData.password) {
                    await usersAPI.updatePassword(editingUserId, formData.password);
                }
                // Permissions update
                await usersAPI.updatePermissions(editingUserId, permissions);

                alert('Kullanıcı güncellendi.');
            } else {
                // Add
                const res = await usersAPI.add(userData);
                if (res.data?.success === false || (res.data?.message && res.data.message.includes('oluşturuldu ancak'))) {
                    // Custom error messages from API
                    throw new Error(res.data.message || 'Kullanıcı oluşturulurken bir hata oluştu.');
                }
            }

            setShowModal(false);
            loadUsers();
            setStatusModal({
                isOpen: true,
                title: 'Başarılı',
                message: isEditMode ? 'Kullanıcı başarıyla güncellendi.' : 'Yeni kullanıcı başarıyla oluşturuldu.',
                type: 'success'
            });
        } catch (error) {
            let msg = error.response?.data?.message || error.message || 'Bir hata oluştu.';

            // Translate Supabase Rate Limit Error
            if (msg.includes('security purposes') && msg.includes('seconds')) {
                const seconds = msg.match(/\d+/)?.[0] || 'birkaç';
                msg = `Güvenlik nedeniyle işlem kısıtlandı. Lütfen ${seconds} saniye bekleyip tekrar deneyin.`;
            } else if (msg.includes('Rate limit')) {
                msg = `Çok fazla deneme yaptınız. Lütfen biraz bekleyin.`;
            } else if (msg.includes('User already registered') || msg.includes('already registered')) {
                msg = 'Bu E-posta adresi ile daha önce kayıt yapılmış.';
            }

            setStatusModal({
                isOpen: true,
                title: 'İşlem Başarısız',
                message: msg,
                type: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
        try {
            await usersAPI.delete(id);
            loadUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleForceLogout = async (id) => {
        if (!confirm('Bu kullanıcının oturumunu kapatmak istediğinizden emin misiniz?')) return;
        try {
            await usersAPI.forceLogout(id);
            alert('Kullanıcının oturumu kapatıldı.');
            loadUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSavePermissions = async () => {
        try {
            await usersAPI.updatePermissions(selectedUser.id, permissions);
            setShowPermModal(false);
            loadUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSaveSchedule = async () => {
        try {
            await usersAPI.updateSchedule(selectedUser.id, schedule);
            setShowScheduleModal(false);
            loadUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const handlePasswordChange = async (userId) => {
        const newPassword = prompt('Yeni şifreyi girin:');
        if (!newPassword) return;
        try {
            await usersAPI.updatePassword(userId, newPassword);
            alert('Şifre güncellendi.');
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const toggleDay = (day) => {
        setSchedule(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    };

    const permissionList = [
        { key: 'can_view_products', label: 'Ürünler', icon: '📦' },
        { key: 'can_view_customers', label: 'Müşteriler', icon: '👥' },
        { key: 'can_view_invoices', label: 'Gelen Faturalar', icon: '📄' },
        { key: 'can_view_sales', label: 'Satış Geçmişi', icon: '📋' },
        { key: 'can_view_pos', label: 'Satış Ekranı (POS)', icon: '🛒' },
        { key: 'can_view_users', label: 'Kullanıcılar', icon: '👤' },
        { key: 'can_view_balances', label: 'Bakiye Görme', icon: '💰' },
        { key: 'can_view_prices', label: 'Fiyat Görme', icon: '💵' },
    ];

    const daysList = [
        { key: 'monday', label: 'Pazartesi' },
        { key: 'tuesday', label: 'Salı' },
        { key: 'wednesday', label: 'Çarşamba' },
        { key: 'thursday', label: 'Perşembe' },
        { key: 'friday', label: 'Cuma' },
        { key: 'saturday', label: 'Cumartesi' },
        { key: 'sunday', label: 'Pazar' },
    ];

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Giriş Yok';
        const d = new Date(dateStr);
        return d.toLocaleString('tr-TR');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-5 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">👤 Kullanıcı Yönetimi</h1>
                    <p className="text-gray-500 text-sm mt-1">{users.length} kullanıcı kayıtlı</p>
                </div>
                {isKurucu && (
                    <button
                        onClick={openAddModal}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 justify-center"
                    >
                        <span>➕</span> Yeni Kullanıcı
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white text-center">
                    <p className="text-blue-100 text-sm">Toplam</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white text-center">
                    <p className="text-violet-100 text-sm">Kurucular</p>
                    <p className="text-2xl font-bold">{users.filter((u) => u.role === 'kurucu').length}</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-4 text-white text-center">
                    <p className="text-cyan-100 text-sm">Çalışanlar</p>
                    <p className="text-2xl font-bold">{users.filter((u) => u.role === 'calisan').length}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white text-center">
                    <p className="text-emerald-100 text-sm">Aktif Oturum</p>
                    <p className="text-2xl font-bold">{users.filter((u) => u.is_active).length}</p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kullanıcı Adı</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">E-posta</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rol</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Son Giriş</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${user.role === 'kurucu'
                                                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                                : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                                                }`}>
                                                {user.username?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-800">{user.username}</span>
                                                {user.is_active && (
                                                    <span className="w-2 h-2 bg-green-500 rounded-full" title="Aktif" />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-sm">{user.email || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.role === 'kurucu'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {user.role === 'kurucu' ? '👑 Kurucu' : '💼 Çalışan'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-sm">
                                        <span className="flex items-center gap-1">
                                            🕐 {formatDate(user.last_login)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isKurucu && user.id !== currentUser?.id && (
                                            <div className="flex justify-end gap-1 flex-wrap">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="px-2 py-1.5 text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    title="Düzenle"
                                                >
                                                    ✏️ Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleForceLogout(user.id)}
                                                    className="px-2 py-1.5 text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                                                    title="Oturumu Kapat"
                                                >
                                                    ⚡ Çıkış
                                                </button>
                                                <button
                                                    onClick={() => openPermModal(user)}
                                                    className="px-2 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Erişim Yetkileri"
                                                >
                                                    🔐 Erişim Yetkileri
                                                </button>
                                                <button
                                                    onClick={() => openScheduleModal(user)}
                                                    className="px-2 py-1.5 text-xs bg-violet-50 text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                                                    title="Erişim Takvimi"
                                                >
                                                    📅 Takvim
                                                </button>
                                                {/* Only allow deleting 'calisan', protect 'kurucu' (Main Account) */}
                                                {user.role !== 'kurucu' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="px-2 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                                        title="Sil"
                                                    >
                                                        🗑️ Sil
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && (
                        <div className="text-center py-12 text-gray-500">Kayıtlı kullanıcı yok.</div>
                    )}
                </div>
            </div>

            {/* Add User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">{isEditMode ? '✏️ Kullanıcı Düzenle' : '➕ Yeni Çalışan Ekle'}</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı *</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">E-posta {isEditMode ? '' : '*'}</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEditMode ? 'bg-gray-50 text-gray-500' : ''}`}
                                        required={!isEditMode}
                                        disabled={isEditMode}
                                        placeholder={isEditMode ? 'E-posta değiştirilemez' : ''}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Şifre {isEditMode ? '(Boş ise değişmez)' : '*'}</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required={!isEditMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="calisan">Çalışan</option>
                                        <option value="kurucu">Kurucu</option>
                                    </select>
                                </div>
                            </div>


                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                                    disabled={isSubmitting}
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            İşleniyor...
                                        </>
                                    ) : (
                                        isEditMode ? 'Güncelle' : 'Kullanıcıyı Ekle'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Processing Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60]">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-slow">
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-800">İşleminiz Yapılıyor</h3>
                        <p className="text-gray-500 mt-2">Lütfen bekleyiniz...</p>
                    </div>
                </div>
            )}

            {/* Processing Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[60]">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-slow">
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-800">İşleminiz Yapılıyor</h3>
                        <p className="text-gray-500 mt-2">Lütfen bekleyiniz...</p>
                    </div>
                </div>
            )}

            {/* Permissions Modal */}
            {showPermModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">🔐 Kullanıcı Yetkilerini Düzenle</h2>
                            <p className="text-gray-500 text-sm mt-1">Kullanıcı: <strong>{selectedUser.username}</strong></p>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                {permissionList.map((perm) => (
                                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={permissions[perm.key] || false}
                                            onChange={(e) => setPermissions({ ...permissions, [perm.key]: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{perm.icon} {perm.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowPermModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSavePermissions}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                            >
                                Değişiklikleri Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Modal */}
            {showScheduleModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">📅 Erişim Takvimi Düzenle</h2>
                            <p className="text-gray-500 text-sm mt-1">Kullanıcı: <strong>{selectedUser.username}</strong></p>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Days Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Erişim Günleri</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {daysList.map((day) => (
                                        <label key={day.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={schedule.days?.includes(day.key) || false}
                                                onChange={() => toggleDay(day.key)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{day.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Time Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                                    <input
                                        type="time"
                                        value={schedule.start_time || '00:00'}
                                        onChange={(e) => setSchedule({ ...schedule, start_time: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                                    <input
                                        type="time"
                                        value={schedule.end_time || '23:59'}
                                        onChange={(e) => setSchedule({ ...schedule, end_time: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowScheduleModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveSchedule}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />
        </div>
    );
}
