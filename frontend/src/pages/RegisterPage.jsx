import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usersAPI } from '../services/api';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: '',
        companyName: '', // Kullanıcıdan işletme adı da istiyoruz artık
        email: '',
        phone: '', // Telefon alanı eklendi
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            setLoading(false);
            return;
        }

        try {
            // Generate 7-digit Company Code
            const companyCode = Math.floor(1000000 + Math.random() * 9000000).toString();

            // API çağrısı - Mevcut API yapısına uygun şekilde veri gönderiyoruz
            // Not: Backend 'companyName' ve 'phone' alanlarını destekliyorsa gönderilmeli
            // Şimdilik username alanını Ad Soyad için kullanıyoruz.
            const res = await usersAPI.registerTenant({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                company_code: companyCode,
                // Ek alanları backend desteklemiyorsa bile göndermek genellikle hata vermez, 
                // ama API'nin yapısına göre bu alanlar kaydedilip edilmeyeceği değişir.
            });

            if (res.data?.success) {
                navigate('/login');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Kayıt sırasında bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-surface text-text-main min-h-screen flex flex-col font-display antialiased selection:bg-mint-accent selection:text-primary-deep overflow-x-hidden">
            <div className="flex flex-1 flex-row overflow-hidden h-screen">
                {/* Sol Panel: Görsel ve Marka */}
                <div className="hidden lg:flex lg:w-1/2 relative bg-mint-light items-center justify-center p-12 overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                        <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#134E4A" strokeWidth="1"></path>
                                </pattern>
                            </defs>
                            <rect fill="url(#grid)" height="100%" width="100%"></rect>
                        </svg>
                    </div>
                    {/* Background Orbs */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl mix-blend-multiply"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-mint-accent rounded-full blur-3xl mix-blend-multiply"></div>

                    <div className="relative z-10 flex flex-col items-center text-center max-w-md">
                        <div className="mb-8 p-6 bg-white rounded-[2rem] shadow-xl shadow-teal-100/50">
                            <svg className="text-primary size-14" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 className="text-primary-deep text-4xl font-extrabold tracking-tight mb-5">İşletmenizi Dijitalleştirin</h2>
                        <p className="text-text-sub text-lg font-medium leading-relaxed">
                            Modern perakende çözümleriyle satışlarınızı artırın, envanterinizi saniyeler içinde yönetin. Güçlü, hızlı ve güvenilir.
                        </p>
                        <div className="mt-12 grid grid-cols-2 gap-4 w-full">
                            <div className="glass-badge p-5 rounded-2xl flex flex-col items-center">
                                <span className="material-symbols-outlined text-primary mb-2 text-3xl">speed</span>
                                <p className="text-primary-deep text-sm font-bold">Hızlı İşlem</p>
                            </div>
                            <div className="glass-badge p-5 rounded-2xl flex flex-col items-center">
                                <span className="material-symbols-outlined text-primary mb-2 text-3xl">shield</span>
                                <p className="text-primary-deep text-sm font-bold">Güvenli Altyapı</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sağ Panel: Kayıt Formu */}
                <div className="w-full lg:w-1/2 flex flex-col bg-white h-full overflow-y-auto relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-mint-light rounded-bl-full -z-0 opacity-50 pointer-events-none"></div>

                    {/* Mobile Header */}
                    <div className="lg:hidden px-6 py-6 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-20">
                        <div className="flex items-center gap-2">
                            <svg className="text-primary size-7" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                            </svg>
                            <span className="font-bold text-lg text-primary-deep">Kasa POS</span>
                        </div>
                        <Link className="text-primary font-bold text-sm bg-mint-light px-4 py-2 rounded-full hover:bg-mint-accent transition-colors" to="/login">Giriş Yap</Link>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 py-12 lg:py-8 z-10 w-full">
                        <div className="w-full max-w-[480px]">
                            <div className="mb-8 text-center lg:text-left">
                                <h1 className="text-text-main tracking-tight text-3xl lg:text-4xl font-extrabold mb-3">Hesabınızı Oluşturun</h1>
                                <p className="text-text-sub text-lg">Kasa POS ile işletmenizi büyütmeye başlayın.</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2 text-sm">
                                    <span className="material-symbols-outlined text-[20px]">error</span>
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="flex flex-col gap-2">
                                    <label className="text-text-main text-sm font-bold ml-1">Tam Ad</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[22px]">person</span>
                                        <input
                                            className="form-input flex w-full rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-200 h-14 pl-12 pr-4 placeholder:text-gray-400 text-base text-text-main shadow-input outline-none"
                                            placeholder="Ad Soyad"
                                            type="text"
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-text-main text-sm font-bold ml-1">İşletme Adı</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[22px]">storefront</span>
                                        <input
                                            className="form-input flex w-full rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-200 h-14 pl-12 pr-4 placeholder:text-gray-400 text-base text-text-main shadow-input outline-none"
                                            placeholder="Mağaza veya Şirket Adı"
                                            type="text"
                                            value={formData.companyName}
                                            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-text-main text-sm font-bold ml-1">E-posta</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[22px]">mail</span>
                                        <input
                                            className="form-input flex w-full rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-200 h-14 pl-12 pr-4 placeholder:text-gray-400 text-base text-text-main shadow-input outline-none"
                                            placeholder="email@ornek.com"
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-text-main text-sm font-bold ml-1">Telefon Numarası</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[22px]">phone</span>
                                        <input
                                            className="form-input flex w-full rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-200 h-14 pl-12 pr-4 placeholder:text-gray-400 text-base text-text-main shadow-input outline-none"
                                            placeholder="05XX XXX XX XX"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-text-main text-sm font-bold ml-1">Şifre</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[22px]">lock</span>
                                        <input
                                            className="form-input flex w-full rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all duration-200 h-14 pl-12 pr-12 placeholder:text-gray-400 text-base text-text-main shadow-input outline-none"
                                            placeholder="••••••••"
                                            type="password"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            required
                                        />
                                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors outline-none" type="button">
                                            <span className="material-symbols-outlined">visibility_off</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 py-2 ml-1">
                                    <div className="flex items-center h-5">
                                        <input className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary focus:ring-offset-0 cursor-pointer" id="terms" type="checkbox" required />
                                    </div>
                                    <label className="text-sm text-text-sub" htmlFor="terms">
                                        <a className="text-primary hover:text-primary-hover font-bold hover:underline" href="#">Kullanım Şartları</a> ve <a className="text-primary hover:text-primary-hover font-bold hover:underline" href="#">Gizlilik Politikası</a>'nı kabul ediyorum.
                                    </label>
                                </div>

                                <button
                                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-soft hover:shadow-lg hover:-translate-y-0.5 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Kayıt Yapılıyor...
                                        </div>
                                    ) : (
                                        'Kayıt Ol'
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 pt-8 border-t border-gray-50 text-center">
                                <p className="text-text-sub">
                                    Zaten bir hesabınız var mı?
                                    <Link className="text-primary font-bold hover:underline ml-1" to="/login">Giriş Yap</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
