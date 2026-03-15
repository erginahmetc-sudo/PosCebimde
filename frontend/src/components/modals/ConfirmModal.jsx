import React from 'react';

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Evet, Onaylıyorum', 
    cancelText = 'Vazgeç',
    type = 'danger' // danger, primary, success
}) {
    if (!isOpen) return null;

    const config = {
        danger: {
            icon: 'delete_forever',
            bg: 'bg-rose-50',
            iconBg: 'bg-rose-100',
            iconColor: 'text-rose-600',
            titleColor: 'text-rose-900',
            btnBg: 'bg-rose-600 hover:bg-rose-700',
        },
        primary: {
            icon: 'save',
            bg: 'bg-indigo-50',
            iconBg: 'bg-indigo-100',
            iconColor: 'text-indigo-600',
            titleColor: 'text-indigo-900',
            btnBg: 'bg-indigo-600 hover:bg-indigo-700',
        },
        success: {
            icon: 'check_circle',
            bg: 'bg-emerald-50',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            titleColor: 'text-emerald-900',
            btnBg: 'bg-emerald-600 hover:bg-emerald-700',
        }
    };

    const style = config[type] || config.primary;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                <div className={`p-6 flex flex-col items-center text-center ${style.bg}`}>
                    <div className={`w-16 h-16 rounded-full ${style.iconBg} flex items-center justify-center shadow-inner mb-4 ${style.iconColor}`}>
                        <span className="material-symbols-outlined text-4xl">{style.icon}</span>
                    </div>
                    <h3 className={`text-xl font-black ${style.titleColor} mb-2`}>{title}</h3>
                    <p className="text-slate-600 font-medium leading-relaxed">{message}</p>
                </div>
                <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-lg shadow-black/5 transition-all active:scale-95 ${style.btnBg}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
