import React, { useState, useEffect } from 'react';

export default function PasswordModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = 'Güvenlik Doğrulaması', 
    message = 'Lütfen bu işlem için parolayı giriniz.',
    confirmText = 'Doğrula',
    cancelText = 'İptal',
    correctPassword // Pass the password to check against
}) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (password === correctPassword) {
            onConfirm();
            onClose();
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-300">
                {/* Header Decoration */}
                <div className="h-2 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500"></div>
                
                <div className="p-8 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-3xl bg-teal-50 flex items-center justify-center shadow-inner mb-6 text-teal-600 transition-transform hover:scale-110 duration-500 group">
                        <span className="material-symbols-outlined text-5xl group-hover:rotate-12 transition-transform">lock</span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 mb-2 leading-tight">{title}</h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">{message}</p>
                    
                    <div className="w-full relative group">
                        <div className={`absolute -inset-1 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500 ${error ? 'from-rose-500 to-red-500 opacity-40' : ''}`}></div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">key</span>
                            <input
                                autoFocus
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Parola"
                                className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-2xl outline-none transition-all text-center text-xl font-mono tracking-[0.5em] placeholder:tracking-normal placeholder:font-sans placeholder:text-base ${error ? 'border-rose-200 bg-rose-50 placeholder:text-rose-300' : 'border-slate-100 focus:border-teal-500 focus:bg-white'}`}
                            />
                        </div>
                    </div>
                    
                    {error && (
                        <div className="mt-4 text-rose-500 font-bold text-sm animate-bounce flex items-center gap-2">
                             <span className="material-symbols-outlined text-sm">error</span>
                             Hatalı Parola! Lütfen tekrar deneyin.
                        </div>
                    )}
                </div>

                <div className="px-8 pb-8 flex flex-col gap-3">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
