import React from 'react';

export default function StatusModal({ isOpen, onClose, title, message, type = 'error', details = null, actionButton = null }) {
    if (!isOpen) return null;

    const config = {
        success: {
            icon: 'check_circle',
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
            iconColor: 'text-emerald-500',
            button: 'bg-emerald-600 hover:bg-emerald-700'
        },
        error: {
            icon: 'error',
            bg: 'bg-rose-50',
            text: 'text-rose-700',
            iconColor: 'text-rose-500',
            button: 'bg-rose-600 hover:bg-rose-700'
        },
        warning: {
            icon: 'warning',
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            iconColor: 'text-amber-500',
            button: 'bg-amber-600 hover:bg-amber-700'
        },
        info: {
            icon: 'info',
            bg: 'bg-blue-50',
            text: 'text-blue-700',
            iconColor: 'text-blue-500',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    };

    const style = config[type] || config.info;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                <div className={`p-6 flex flex-col items-center text-center ${style.bg}`}>
                    <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4 ${style.text}`}>
                        <span className="material-symbols-outlined text-4xl">{style.icon}</span>
                    </div>
                    <h3 className={`text-xl font-black ${style.text} mb-2`}>{title}</h3>
                    <p className="text-slate-600 font-medium leading-relaxed">{message}</p>

                    {details && (
                        <div className="mt-4 p-3 bg-white/50 rounded-lg border border-black/5 text-xs text-slate-500 font-mono text-left w-full overflow-x-auto whitespace-pre-wrap">
                            {details}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
                    {actionButton && (
                        <button
                            onClick={actionButton.onClick}
                            className={`w-full py-3 rounded-xl font-bold shadow-sm transition-all active:scale-95 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 ${actionButton.className || ''}`}
                        >
                            {actionButton.label}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-sm transition-all active:scale-95 ${style.button}`}
                    >
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    );
}
