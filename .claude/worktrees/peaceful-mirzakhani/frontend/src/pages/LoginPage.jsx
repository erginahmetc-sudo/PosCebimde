import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import StatusModal from '../components/modals/StatusModal';

export default function LoginPage() {
    const [step, setStep] = useState(1); // 1: Email/Password, 2: OTP
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        otp: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'error' });
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // First step: Login to get token/session
            await authAPI.login(formData.email, formData.password);
            
            // Second step: Send OTP for 2FA verification
            await authAPI.sendOtp(formData.email);
            setStep(2);
        } catch (err) {
            const message = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Giriş başarısız. Bilgilerinizi kontrol edin.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const verifyResponse = await authAPI.verifyOtp(formData.email, formData.otp);
            if (verifyResponse.status === 200) {
                const userData = verifyResponse.data.user;
                await login(userData);
                navigate('/');
            }
        } catch (err) {
            const message = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Doğrulama kodu hatalı.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen antialiased text-text-main flex items-center justify-center p-4 lg:p-8 login-bg relative overflow-hidden">
            {/* Background Orbs */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] bg-teal-200/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-1/4 w-[600px] h-[600px] bg-sky-100/30 rounded-full blur-[100px]"></div>
            </div>

            <main className="relative w-full max-w-6xl aspect-[16/10] max-h-[90vh] glass-card rounded-[2.5rem] soft-shadow flex overflow-hidden border border-white/50 z-10" data-purpose="main-window">
                {/* BEGIN: LeftHeroSection */}
                <section className="hidden md:flex w-1/2 bg-[#f0fdfa]/50 p-12 flex-col justify-between relative overflow-hidden" data-purpose="hero-content">
                    {/* Decorative background blur */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-teal-200/30 rounded-full blur-3xl"></div>
                    <div className="z-10">
                        {/* Brand Logo */}
                        <div className="flex items-center gap-3 mb-16">
                            <div className="w-10 h-10 teal-gradient rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                                </svg>
                            </div>
                            <span className="text-2xl font-bold text-slate-800 tracking-tight">Kasa POS</span>
                        </div>
                        {/* Hero Text */}
                        <div className="space-y-6">
                            <h1 className="text-5xl font-extrabold text-slate-900 leading-[1.1]">
                                Satışlarınız <br />
                                <span className="text-teal-600">Anında</span> Yazdırılsın.
                            </h1>
                            <p className="text-lg text-slate-600 max-w-sm leading-relaxed">
                                Kasa POS sistemlerine sorunsuz bağlanın, işletmenizin verimliliğini 2026 teknolojisi ile zirveye taşıyın.
                            </p>
                        </div>
                    </div>
                    {/* Feature Highlight Cards */}
                    <div className="z-10 grid grid-cols-2 gap-4">
                        {/* Feature 1: Anlık */}
                        <div className="bg-white/60 p-5 rounded-2xl border border-white/80 shadow-sm backdrop-blur-sm group hover:bg-white transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <h3 className="font-bold text-slate-800">Anlık</h3>
                            <p className="text-xs text-slate-500 mt-1">Saniyeler içinde bulut senkronizasyonu.</p>
                        </div>
                        {/* Feature 2: Özelleştir */}
                        <div className="bg-white/60 p-5 rounded-2xl border border-white/80 shadow-sm backdrop-blur-sm group hover:bg-white transition-all duration-300">
                            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <h3 className="font-bold text-slate-800">Özelleştir</h3>
                            <p className="text-xs text-slate-500 mt-1">Fiş tasarımlarınızı özgürce düzenleyin.</p>
                        </div>
                    </div>
                    {/* Footer Links */}
                    <div className="z-10 flex gap-6 text-sm text-slate-400 font-medium">
                        <a className="hover:text-teal-600 transition-colors" href="#">Hakkımızda</a>
                        <a className="hover:text-teal-600 transition-colors" href="#">İletişim</a>
                    </div>
                </section>
                {/* END: LeftHeroSection */}

                {/* BEGIN: RightLoginFormSection */}
                <section className="w-full md:w-1/2 bg-white p-8 md:p-16 flex flex-col justify-center" data-purpose="login-form-container">
                    <div className="max-w-sm mx-auto w-full">
                        {/* Form Header */}
                        <div className="mb-10 text-center md:text-left">
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">
                                {step === 1 ? 'Giriş Yap' : 'Doğrulama'}
                            </h2>
                            <p className="text-slate-500">
                                {step === 1 ? 'Tekrar hoş geldiniz! Hesabınıza erişin.' : 'E-posta adresinize gönderilen 8 haneli kodu girin.'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-2 animate-fadeIn">
                                <span className="material-symbols-outlined text-[20px]">error</span>
                                {error}
                            </div>
                        )}

                        {step === 1 ? (
                            <form onSubmit={handleLoginSubmit} className="space-y-6">
                                {/* Email Field */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="email">E-posta</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </div>
                                        <input
                                            className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                                            id="email"
                                            name="email"
                                            placeholder="isim@sirket.com"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* Password Field */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-sm font-semibold text-slate-700" htmlFor="password">Şifre</label>
                                        <a className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors" href="#">Şifremi Unuttum</a>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </div>
                                        <input
                                            className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                                            id="password"
                                            name="password"
                                            placeholder="••••••••"
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* Submit Button */}
                                <button
                                    className="w-full py-4 px-6 teal-gradient text-white font-bold rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>Giriş Yap</span>
                                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleOtpSubmit} className="space-y-6">
                                {/* OTP Field */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="otp">Doğrulama Kodu</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </div>
                                        <input
                                            className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none tracking-widest text-center font-bold text-lg"
                                            id="otp"
                                            name="otp"
                                            placeholder="••••••••"
                                            type="text"
                                            maxLength={8}
                                            value={formData.otp}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 8) setFormData({ ...formData, otp: val });
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                                {/* Submit Button */}
                                <button
                                    className="w-full py-4 px-6 teal-gradient text-white font-bold rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading || formData.otp.length !== 8}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>Doğrula ve Giriş Yap</span>
                                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-full mt-2 flex items-center justify-center py-3 px-6 rounded-2xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold text-sm transition-all duration-200"
                                >
                                    Geri Dön
                                </button>
                            </form>
                        )}

                        {/* Form Footer */}
                        <div className="mt-12 text-center">
                            <p className="text-slate-500 text-sm">
                                Kasa POS'ta yeni misiniz?
                                <Link className="text-teal-600 font-bold hover:underline ml-1" to="/register">Hesap Oluşturun</Link>
                            </p>
                        </div>
                        {/* Social Login Hint */}
                        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center gap-4">
                            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                                <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.32-2.12 4.52-1.2 1.2-3.04 2.12-5.72 2.12-4.64 0-8.44-3.76-8.44-8.4s3.8-8.4 8.44-8.4c2.52 0 4.36 1 5.76 2.32l2.32-2.32C18.44 2.12 15.72 1 12.48 1 5.84 1 .4 6.44.4 13.08S5.84 25.16 12.48 25.16c3.56 0 6.24-1.16 8.36-3.36 2.16-2.16 2.84-5.24 2.84-7.68 0-.76-.08-1.48-.2-2.2h-11z"></path></svg>
                            </div>
                            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                                <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path></svg>
                            </div>
                        </div>
                    </div>
                </section>
                {/* END: RightLoginFormSection */}
            </main>

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
