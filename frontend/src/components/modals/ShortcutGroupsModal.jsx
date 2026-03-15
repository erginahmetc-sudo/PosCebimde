import { useState, useEffect } from 'react';
import { shortcutsAPI } from '../../services/api';
import GroupContentModal from './GroupContentModal';

export default function ShortcutGroupsModal({ isOpen, onClose }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [renamingGroup, setRenamingGroup] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGroups();
        }
    }, [isOpen]);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const res = await shortcutsAPI.getAll();
            if (res.data?.shortcuts) {
                setGroups(res.data.shortcuts);
            }
        } catch (error) {
            console.error(error);
            alert("Gruplar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        setAdding(true);
        try {
            // Check duplicate
            if (groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
                alert("Bu isimde bir grup zaten var.");
                setAdding(false);
                return;
            }

            await shortcutsAPI.addCategory(newGroupName.trim());
            setNewGroupName('');
            await loadGroups();
        } catch (error) {
            console.error(error);
            alert("Grup eklenirken hata oluştu.");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`${name} grubunu silmek istediğinize emin misiniz?`)) return;

        try {
            await shortcutsAPI.deleteCategory(name);
            await loadGroups();
        } catch (error) {
            console.error(error);
            alert("Silme işlemi başarısız.");
        }
    };

    const openRenameModal = (groupName) => {
        setRenamingGroup(groupName);
        setRenameValue(groupName);
    };

    const handleRename = async () => {
        if (!renameValue.trim() || renameValue.trim() === renamingGroup) {
            setRenamingGroup(null);
            return;
        }

        // Check for duplicate
        if (groups.some(g => g.name.toLowerCase() === renameValue.trim().toLowerCase() && g.name !== renamingGroup)) {
            alert("Bu isimde bir grup zaten var.");
            return;
        }

        setRenaming(true);
        try {
            await shortcutsAPI.updateCategory(renamingGroup, { name: renameValue.trim() });
            await loadGroups();
            setRenamingGroup(null);
        } catch (error) {
            console.error(error);
            alert("İsim değiştirme başarısız.");
        } finally {
            setRenaming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                {/* Header - More Spacious */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Kısayol Grupları</h2>
                            <p className="text-indigo-200 mt-1">Satış ekranı için özel kategoriler oluşturun ve yönetin</p>
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
                <div className="p-8">
                    {/* Add Form - Larger */}
                    <form onSubmit={handleAdd} className="flex gap-3 mb-8">
                        <input
                            type="text"
                            placeholder="Yeni Grup Adı (Örn: Çerezler, İçecekler, Atıştırmalıklar)"
                            className="flex-1 px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-base"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={adding || !newGroupName.trim()}
                            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base shadow-lg shadow-emerald-500/25"
                        >
                            {adding ? 'Ekleniyor...' : '+ Yeni Grup Ekle'}
                        </button>
                    </form>

                    {/* List - Larger Items */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {loading ? (
                            <div className="text-center py-12 text-gray-500">
                                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                Gruplar yükleniyor...
                            </div>
                        ) : groups.length === 0 ? (
                            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <span className="text-5xl block mb-4">📂</span>
                                <p className="text-gray-600 text-lg font-medium">Henüz grup oluşturulmadı</p>
                                <p className="text-gray-400 text-sm mt-1">Yukarıdaki alandan yeni bir grup ekleyin</p>
                            </div>
                        ) : (
                            groups.map((group) => (
                                <div
                                    key={group.id || group.name}
                                    className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/25">
                                            {group.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-semibold text-gray-800 text-lg">{group.name}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openRenameModal(group.name)}
                                            className="px-4 py-2.5 bg-amber-100 hover:bg-amber-600 text-amber-700 hover:text-white rounded-xl font-semibold transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                            İsmi Değiştir
                                        </button>
                                        <button
                                            onClick={() => setEditingGroup(group.name)}
                                            className="px-4 py-2.5 bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl font-semibold transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Düzenle
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group.name)}
                                            className="px-4 py-2.5 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white rounded-xl font-semibold transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer - Larger */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-base font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm"
                    >
                        Kapat
                    </button>
                </div>

                <GroupContentModal
                    isOpen={!!editingGroup}
                    onClose={() => setEditingGroup(null)}
                    groupName={editingGroup}
                />

                {/* Rename Modal */}
                {renamingGroup && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                                <h3 className="text-xl font-bold text-white">Grup İsmini Değiştir</h3>
                                <p className="text-amber-100 text-sm mt-1">Yeni grup adını giriniz</p>
                            </div>
                            <div className="p-6">
                                <label className="text-base font-semibold text-gray-800 mb-2 block">Grup Adı</label>
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-base"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                />
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setRenamingGroup(null)}
                                    className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-100 transition-all"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleRename}
                                    disabled={renaming || !renameValue.trim()}
                                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
                                >
                                    {renaming ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
