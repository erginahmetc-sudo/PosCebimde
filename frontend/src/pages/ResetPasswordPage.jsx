import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Supabase PASSWORD_RECOVERY olayını dinle
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            }
        });

        // Sayfa yüklendiğinde mevcut session kontrolü (hash fragment ile gelenler için)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            return;
        }
        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.message || 'Şifre güncellenirken bir hata oluştu.');
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

            <main className="relative w-full max-w-md glass-card rounded-3xl soft-shadow overflow-hidden border border-white/50 z-10 bg-white p-8 md:p-12">
                <div className="mb-8 text-center">
                    {/* Logo */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-10 h-10 teal-gradient rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">PosCebimde</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Yeni Şifre Belirle</h2>
                    <p className="text-slate-500">Hesabınız için yeni bir şifre oluşturun.</p>
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Şifreniz Güncellendi!</h3>
                        <p className="text-slate-500 text-sm">Giriş sayfasına yönlendiriliyorsunuz...</p>
                    </div>
                ) : !sessionReady ? (
                    <div className="text-center py-8">
                        <div className="w-10 h-10 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500 text-sm">Bağlantı doğrulanıyor...</p>
                        <p className="text-slate-400 text-xs mt-2">E-postanızdaki linke tıklayarak bu sayfaya gelmeniz gerekmektedir.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                </svg>
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="password">Yeni Şifre</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <input
                                    className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                                    id="password"
                                    placeholder="••••••••"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="confirmPassword">Şifre Tekrar</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                </div>
                                <input
                                    className="block w-full pl-11 pr-4 py-4 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                                    id="confirmPassword"
                                    placeholder="••••••••"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            className="w-full py-4 px-6 teal-gradient text-white font-bold rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Şifremi Güncelle'
                            )}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
}
