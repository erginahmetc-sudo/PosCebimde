import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function LoginPage() {
    const [step, setStep] = useState('LOGIN'); // 'LOGIN' | 'OTP'
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        otp: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Step 1: Verify Password first
            const loginResponse = await authAPI.login(formData.email, formData.password);

            if (loginResponse.status === 200) {
                // If password is correct, send OTP
                await authAPI.sendOtp(formData.email);
                setStep('OTP');
                setError('');
            }
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
            // Step 2: Verify OTP
            const response = await authAPI.verifyOtp(formData.email, formData.otp);

            if (response.status === 200) {
                // Login successful with full user data
                login(response.data.user);
                navigate('/');
            }
        } catch (err) {
             const message = err.response?.data?.message || err.message || 'Kod doğrulanamadı.';
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

            <div className="w-full max-w-6xl h-full lg:h-[85vh] flex flex-col lg:flex-row rounded-3xl overflow-hidden shadow-soft glass-card relative z-10 transition-all duration-500">
                {/* Left Side: Visual/Brand Panel */}
                <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between p-10 bg-gradient-to-br from-teal-50 to-white overflow-hidden">
                    <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>
                    <div className="absolute bottom-[-5%] left-[-5%] w-72 h-72 bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

                    <div className="relative z-10 flex items-center gap-3">
                        <div className="size-10 bg-gradient-to-br from-primary to-teal-400 text-white rounded-xl shadow-md flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-700">Kasa POS</span>
                    </div>

                    <div className="relative z-10 my-auto">
                        <div className="aspect-[4/3] w-full rounded-2xl shadow-xl overflow-hidden border border-white/50 relative group">
                            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBuiogz1WQpIFoh5BpePE0hk1DFUE014QA2hWUj2KbFl-PaNL47BOqaR4PuP9KAT_wMnH0pE7A085jzBeSKRwatJW4zNkAPuVS0TU7a9-lCb7NkINxMMQO5k4vCZ8NqONAv1_7EQTbStUVo2kZeTs4ouqyYyqkGt6yp-KVZHWQGwJXqSfUSkWz2GuiOkp__9hIf7ZZnsW-qhnRsCEmZ2NtzgUEVwXt4Su46UDSdpqX-yZSDz2NSXKw98gu4Qw4S5wbr58YaQRNUHm0")' }}>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                            <div className="absolute bottom-0 left-0 w-full p-6 text-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider border border-white/10">Başarı Hikayesi</span>
                                </div>
                                <p className="text-base font-light leading-relaxed text-white/95">
                                    "Kullanıcı dostu arayüzü sayesinde personelimiz çok daha hızlı ve hatasız çalışıyor."
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-8">
                        <div className="flex gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-primary border border-slate-100">
                                    <span className="material-symbols-outlined text-xl">cloud_queue</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-slate-700">Bulut Senkronizasyon</h4>
                                    <p className="text-xs text-slate-500">Her zaman güncel</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-primary border border-slate-100">
                                    <span className="material-symbols-outlined text-xl">security</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-slate-700">Güvenli</h4>
                                    <p className="text-xs text-slate-500">Uçtan uca şifreleme</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200/50">
                            <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Hakkımızda</a>
                            <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">İletişim</a>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-16 bg-white/40 backdrop-blur-sm relative">
                    <div className="w-full max-w-[400px]">
                        {/* Mobile Logo */}
                        <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
                            {/* Logo SVG */}
                            <div className="size-10 bg-primary text-white rounded-xl shadow-lg flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                                </svg>
                            </div>
                        </div>

                        <div className="mb-8 text-center lg:text-left">
                            <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
                                {step === 'LOGIN' ? 'Giriş Yap' : 'Güvenlik Doğrulaması'}
                            </h1>
                            <p className="text-slate-500 font-normal">
                                {step === 'LOGIN' 
                                    ? 'Tekrar hoş geldiniz! Hesabınıza erişin.' 
                                    : `Lütfen ${formData.email} adresine gönderilen doğrulama kodunu girin.`}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2 shadow-sm animate-pulse">
                                <span className="material-symbols-outlined text-[20px]">error</span>
                                {error}
                            </div>
                        )}

                        <form onSubmit={step === 'LOGIN' ? handleSubmit : handleOtpSubmit} className="space-y-5">
                            
                            {step === 'LOGIN' && (
                                <>
                                    <div className="space-y-1.5 group">
                                        <label className="block text-sm font-semibold text-slate-600 ml-1">E-posta</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">mail</span>
                                            </span>
                                            <input
                                                className="glass-input block w-full pl-10 pr-4 py-3 bg-white/60 border border-border-subtle rounded-xl text-sm transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-slate-700 placeholder-slate-400 hover:border-slate-300 hover:bg-white/80"
                                                placeholder="isim@sirket.com"
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 group">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="block text-sm font-semibold text-slate-600">Şifre</label>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">lock</span>
                                            </span>
                                            <input
                                                className="glass-input block w-full pl-10 pr-10 py-3 bg-white/60 border border-border-subtle rounded-xl text-sm transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-slate-700 placeholder-slate-400 hover:border-slate-300 hover:bg-white/80"
                                                placeholder="••••••••"
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 'OTP' && (
                                <div className="space-y-1.5 group animate-in fade-in zoom-in duration-300">
                                    <label className="block text-sm font-semibold text-slate-600 ml-1">Doğrulama Kodu</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">vpn_key</span>
                                        </span>
                                        <input
                                            className="glass-input block w-full pl-10 pr-4 py-3 bg-white/60 border border-border-subtle rounded-xl text-sm transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-slate-700 placeholder-slate-400 hover:border-slate-300 hover:bg-white/80 text-center tracking-[0.5em] font-mono text-lg"
                                            placeholder="123456"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={8}
                                            value={formData.otp}
                                            onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 ml-1">
                                        Lütfen e-posta adresinize gönderilen 6 veya 8 haneli kodu giriniz.
                                    </p>
                                </div>
                            )}

                            <button
                                className="w-full flex items-center justify-center py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-base shadow-lg shadow-teal-500/20 transition-all duration-200 hover:shadow-teal-500/30 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    step === 'LOGIN' ? 'Devam Et' : 'Doğrula ve Giriş Yap'
                                )}
                            </button>

                            {step === 'OTP' && (
                                <button
                                    type="button"
                                    onClick={() => setStep('LOGIN')}
                                    className="w-full text-sm text-slate-500 hover:text-primary transition-colors mt-4"
                                    disabled={loading}
                                >
                                    E-posta adresini değiştir
                                </button>
                            )}
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-slate-500 font-medium">
                                Kasa POS'ta yeni misiniz?
                                <Link className="text-primary font-bold hover:text-primary-hover hover:underline decoration-2 underline-offset-4 transition-all ml-1" to="/register">Hesap Oluşturun</Link>
                            </p>
                        </div>
                        
                        {/* Footer Links (Mobile) */}
                        <div className="mt-auto lg:hidden pt-8 text-center">
                             <div className="flex justify-center gap-6">
                                <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Destek</a>
                                <a className="text-xs font-medium text-slate-400 hover:text-primary transition-colors" href="#">Gizlilik</a>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
