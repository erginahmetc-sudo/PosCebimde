import React, { useState, useEffect } from 'react';
import { customersAPI } from '../../services/api';

export default function PaymentFormModal({ isOpen, onClose, onSuccess, transactionType = 'payment', customers = [] }) {
    // transactionType: 'payment' (collection) or 'debt' (manual debit)
    const [paymentData, setPaymentData] = useState({
        customer_id: '',
        amount: '',
        description: '',
        payment_type: 'Nakit'
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPaymentData({
                customer_id: '',
                amount: '',
                description: transactionType === 'payment' ? 'Ödeme' : 'Firmaya Ödeme Yapıldı',
                payment_type: 'Nakit'
            });
            setError('');
        }
    }, [isOpen, transactionType]);

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentData.customer_id || !paymentData.amount) {
            setError('Lütfen müşteri seçin ve tutar girin.');
            return;
        }

        try {
            let response;
            if (transactionType === 'payment') {
                // Customer pays US (Collection) -> Reduces Balance
                response = await customersAPI.addPayment(paymentData);
            } else {
                // We pay Customer / Add Debt (Debit) -> Increases Balance
                response = await customersAPI.addManualDebit(paymentData);
            }

            if (response.data?.success) {
                if (onSuccess) onSuccess();
                onClose();
            } else {
                setError('Hata: ' + response.data?.message);
            }
        } catch (err) {
            setError('İşlem hatası: ' + (err.response?.data?.message || err.message));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className={`px-10 py-6 bg-gradient-to-br flex-shrink-0 ${transactionType === 'payment' ? 'from-slate-900 via-slate-800 to-slate-900' : 'from-orange-600 via-orange-500 to-amber-500'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${transactionType === 'payment' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30' : 'bg-white/20 backdrop-blur-sm shadow-black/10'}`}>
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {transactionType === 'payment' ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    )}
                                </svg>
                            </div>
                            <div>
                                <h2 className={`text-2xl font-bold text-white tracking-tight ${transactionType === 'debt' ? 'animate-pulse' : ''}`}>
                                    {transactionType === 'payment' ? 'Müşteriden Ödeme Al' : 'Firmaya Ödeme Yap'}
                                </h2>
                                <p className={`text-sm mt-0.5 ${transactionType === 'payment' ? 'text-slate-200' : 'text-white/90'}`}>
                                    {transactionType === 'payment' ? 'Tahsilat işlemini kaydedin' : 'Firma Carisine Borç Ekleyin'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50 to-white">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Müşteri Seç <span className="text-rose-500">*</span></label>
                        <select
                            value={paymentData.customer_id}
                            onChange={(e) => setPaymentData({ ...paymentData, customer_id: e.target.value })}
                            className={`w-full px-4 py-3 text-lg rounded-xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                            required
                        >
                            <option value="">Müşteri seçiniz...</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.customer_code ? `(${c.customer_code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Tutar (₺) <span className="text-rose-500">*</span></label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                            className={`w-full px-4 py-4 text-3xl font-bold rounded-xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all text-center placeholder:text-slate-300 ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">Ödeme Yöntemi</label>
                        <div className="flex gap-3">
                            {['Nakit', 'Kredi Kartı', 'Havale'].map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setPaymentData({ ...paymentData, payment_type: method })}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold text-sm transition-all ${paymentData.payment_type === method
                                        ? (transactionType === 'payment' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30')
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Açıklama</label>
                        <input
                            type="text"
                            value={paymentData.description}
                            onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                            className={`w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all placeholder:text-slate-400 ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                            placeholder={transactionType === 'payment' ? "Örn: Kasım ayı tahsilatı" : "Örn: Firmaya Ödeme Yapıldı"}
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 text-base font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className={`flex-[2] py-3.5 text-base font-bold text-white rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg ${transactionType === 'payment' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30' : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-500 shadow-orange-500/30'}`}
                        >
                            ✓ Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
