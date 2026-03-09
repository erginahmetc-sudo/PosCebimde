import React from 'react';

const DebtLimitAlert = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { currentBalance, transactionAmount, newBalance, limit } = data;
    const overflowAmount = newBalance - limit;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 border border-white/20">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-white text-2xl">error</span>
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Limit Aşıldı!</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 bg-red-50/50">
                    <p className="text-red-900 font-medium text-center mb-6 text-sm">
                        Bu işlem müşterinin belirlenen borç limitini aşmaktadır. <br />
                        Lütfen işlemi kontrol ediniz.
                    </p>

                    <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                        {/* Current Balance */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                            <span className="text-gray-500 text-sm font-medium">Mevcut Bakiye</span>
                            <span className="text-gray-900 font-bold">{currentBalance?.toFixed(2)} TL</span>
                        </div>

                        {/* Transaction Amount */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <span className="text-gray-500 text-sm font-medium">İşlem Tutarı</span>
                            <span className="text-gray-900 font-bold">+{transactionAmount?.toFixed(2)} TL</span>
                        </div>

                        {/* New Balance (Projected) */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                            <span className="text-gray-700 text-sm font-bold">Yeni Bakiye Olacak</span>
                            <span className="text-red-600 font-bold text-lg">{newBalance?.toFixed(2)} TL</span>
                        </div>

                        {/* Limit */}
                        <div className="flex justify-between items-center px-4 py-3 bg-red-50 border-t-2 border-red-100">
                            <span className="text-red-800 text-sm font-bold uppercase tracking-wider">Borç Limiti</span>
                            <span className="text-red-800 font-black text-lg">{limit?.toFixed(2)} TL</span>
                        </div>
                    </div>

                    {/* Overflow Warning */}
                    <div className="mt-4 flex items-center justify-center gap-2 text-red-600 bg-red-100 px-4 py-2 rounded-lg border border-red-200">
                        <span className="material-symbols-outlined text-xl">trending_up</span>
                        <span className="font-bold text-sm">Limit {overflowAmount.toFixed(2)} TL Aşılıyor</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        Anlaşıldı
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebtLimitAlert;
