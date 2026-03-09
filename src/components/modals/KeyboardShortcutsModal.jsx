import React, { useState, useEffect } from 'react';

export default function KeyboardShortcutsModal({ onClose, onSave }) {
    // Default shortcuts
    const defaultShortcuts = {
        'miktar_duzenle': 'F2',
        'iskonto_ekle': 'F3',
        'fiyat_duzenle': 'F4',
        'nakit_odeme': 'F8',
        'pos_odeme': 'F9',
        'musteri_sec': 'F10',
        'search_focus': 'F1',
        'tanimsiz_urun': 'Insert'
    };

    const [shortcuts, setShortcuts] = useState(defaultShortcuts);
    const [activeKey, setActiveKey] = useState(null);

    const [showError, setShowError] = useState(false);

    // Available keys
    const availableKeys = [
        'None', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
        'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'
    ];

    useEffect(() => {
        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error parsing shortcuts", e);
            }
        }
    }, []);

    const handleChange = (action, key) => {
        setShortcuts(prev => ({ ...prev, [action]: key }));
        setActiveKey(null);
    };

    const handleSave = () => {
        // Validate for duplicates
        const values = Object.values(shortcuts).filter(v => v !== 'None');
        const uniqueValues = new Set(values);
        if (values.length !== uniqueValues.size) {
            setShowError(true);
            return;
        }

        localStorage.setItem('pos_keyboard_shortcuts', JSON.stringify(shortcuts));
        window.dispatchEvent(new Event('shortcutsUpdated'));
        if (onSave) onSave(shortcuts);
        onClose();
    };

    const actions = [
        { id: 'search_focus', label: 'Ürün Arama', icon: '🔍' },
        { id: 'tanimsiz_urun', label: 'Tanımsız Ürün Ekle', icon: '➕' },
        { id: 'miktar_duzenle', label: 'Miktar Düzenle', icon: '🔢' },
        { id: 'iskonto_ekle', label: 'İskonto Ekle', icon: '🏷️' },
        { id: 'fiyat_duzenle', label: 'Fiyat Düzenle', icon: '💵' },
        { id: 'musteri_sec', label: 'Müşteri Seç', icon: '👤' },
        { id: 'nakit_odeme', label: 'Nakit Ödeme', icon: '💶' },
        { id: 'pos_odeme', label: 'Kredi Kartı', icon: '💳' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 flex flex-col max-h-[90vh] relative">

                {/* Provide a higher z-index for the error modal to overlay properly if needed, but nesting it here covers the shortcuts modal */}
                {showError && (
                    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl border border-red-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-4 flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <span className="material-symbols-outlined text-white">warning</span>
                                </div>
                                <h3 className="text-lg font-bold text-white">Çakışma Var!</h3>
                            </div>
                            <div className="p-6 text-center">
                                <p className="text-gray-600 font-medium mb-1">
                                    Her tuş sadece 1 kısayola atanabilir.
                                </p>
                                <p className="text-red-500 text-sm font-bold">
                                    Lütfen aynı tuşu birden fazla işlem için kullanmayınız.
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <button
                                    onClick={() => setShowError(false)}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
                                >
                                    Tamam, Düzelteceğim
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-white text-2xl">keyboard</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Klavye Kısayolları</h2>
                            <p className="text-red-100 text-xs mt-0.5 font-medium">Hızlı satış için tuşları özelleştirin</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-red-50/50">
                    <div className="flex flex-col gap-2">
                        {actions.map(action => (
                            <div
                                key={action.id}
                                className={`
                                    group flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                                    ${activeKey === action.id
                                        ? 'bg-white border-red-500 shadow-lg shadow-red-100 ring-1 ring-red-100 transform scale-[1.01] z-10'
                                        : 'bg-white border-red-100 hover:border-red-300 hover:shadow-md'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm transition-colors border
                                        ${activeKey === action.id
                                            ? 'bg-red-50 text-red-600 border-red-200'
                                            : 'bg-gray-50 text-gray-500 border-gray-100 group-hover:bg-white group-hover:text-red-500'
                                        }
                                    `}>
                                        {action.icon}
                                    </div>
                                    <span className={`font-bold text-sm ${activeKey === action.id ? 'text-red-900' : 'text-gray-700'}`}>
                                        {action.label}
                                    </span>
                                </div>
                                <div className="relative">
                                    <select
                                        value={shortcuts[action.id] || 'None'}
                                        onChange={(e) => handleChange(action.id, e.target.value)}
                                        onFocus={() => setActiveKey(action.id)}
                                        onBlur={() => setActiveKey(null)}
                                        className={`
                                            appearance-none cursor-pointer w-24 py-1.5 pl-3 pr-8 text-center font-mono font-bold text-sm rounded-lg border outline-none transition-all
                                            ${activeKey === action.id
                                                ? 'bg-red-50 border-red-500 text-red-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white'
                                            }
                                        `}
                                    >
                                        {availableKeys.map(key => (
                                            <option key={key} value={key}>{key}</option>
                                        ))}
                                    </select>
                                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${activeKey === action.id ? 'text-red-400' : 'text-gray-400'}`}>
                                        <span className="material-symbols-outlined text-sm">expand_more</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0 flex flex-col gap-2">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>Değişiklikleri Kaydet</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-gray-500 font-bold hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors text-sm"
                    >
                        Vazgeç
                    </button>
                </div>
            </div>
        </div>
    );
}
