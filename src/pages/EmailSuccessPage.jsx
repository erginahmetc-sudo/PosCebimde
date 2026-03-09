import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmailSuccessPage() {
    const navigate = useNavigate();

    useEffect(() => {
        // Auto-redirect after 5 seconds
        const timer = setTimeout(() => {
            navigate('/login');
        }, 5000);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-center p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-4">Tebrikler!</h1>
                <p className="text-gray-600 mb-8">
                    E-posta adresiniz başarıyla doğrulandı. Hesabınız artık aktif.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                        Giriş Yap
                    </button>
                    <p className="text-sm text-gray-500">
                        5 saniye içinde otomatik olarak yönlendirileceksiniz...
                    </p>
                </div>
            </div>
        </div>
    );
}
