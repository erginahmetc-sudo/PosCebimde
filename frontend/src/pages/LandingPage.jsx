import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="min-h-screen antialiased text-slate-800 relative overflow-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/40 pointer-events-none z-0"></div>
            <div className="fixed top-[-10%] left-1/4 w-[500px] h-[500px] bg-teal-200/20 rounded-full blur-[100px] pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] right-1/4 w-[600px] h-[600px] bg-sky-100/30 rounded-full blur-[100px] pointer-events-none z-0"></div>

            {/* Navbar */}
            <header className="relative z-20 w-full">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo-v3.png" alt="PosCebimde" className="w-10 h-10 object-contain rounded-xl" />
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">PosCebimde</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAuthenticated ? (
                            <Link
                                to="/pos"
                                className="px-6 py-2.5 teal-gradient text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm no-underline"
                            >
                                Panele Git
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="px-5 py-2.5 text-slate-600 hover:text-teal-600 font-semibold text-sm transition-colors no-underline"
                                >
                                    Giriş Yap
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-6 py-2.5 teal-gradient text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm no-underline"
                                >
                                    Ücretsiz Dene
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                    {/* Left Content */}
                    <div className="flex-1 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 border border-teal-100 rounded-full mb-6">
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Bulut Tabanlı POS Sistemi</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                            İşletmenizi <br />
                            <span className="text-teal-600">Dijitale</span> Taşıyın.
                        </h1>
                        <p className="text-lg text-slate-500 max-w-lg mx-auto lg:mx-0 leading-relaxed mb-10">
                            PosCebimde ile satış, stok, müşteri ve fatura yönetimini tek bir platformdan kolayca yapın.
                            Her cihazdan erişin, gerçek zamanlı raporlarla işletmenizi kontrol altında tutun.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                            {isAuthenticated ? (
                                <Link
                                    to="/pos"
                                    className="w-full sm:w-auto px-8 py-4 teal-gradient text-white font-bold rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group no-underline"
                                >
                                    <span>Satış Ekranına Git</span>
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/register"
                                        className="w-full sm:w-auto px-8 py-4 teal-gradient text-white font-bold rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 group no-underline"
                                    >
                                        <span>Hemen Başla</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                    </Link>
                                    <Link
                                        to="/login"
                                        className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm no-underline"
                                    >
                                        <span>Giriş Yap</span>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Visual */}
                    <div className="flex-1 w-full max-w-lg lg:max-w-xl">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-r from-teal-200/40 to-sky-200/40 rounded-[2rem] blur-2xl"></div>
                            <div className="relative bg-white/70 backdrop-blur-sm rounded-[2rem] border border-white/80 shadow-xl p-8 space-y-6">
                                {/* Mini POS Preview */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                    <span className="ml-2 text-xs text-slate-400 font-mono">poscebimde.com</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                            <span className="text-teal-600 text-lg">1</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">Coca Cola 330ml</div>
                                            <div className="text-xs text-slate-400">Stok: 48 adet</div>
                                        </div>
                                        <div className="text-sm font-bold text-teal-600">₺25.00</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                        <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                                            <span className="text-sky-600 text-lg">2</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">Sandwich Klasik</div>
                                            <div className="text-xs text-slate-400">Stok: 12 adet</div>
                                        </div>
                                        <div className="text-sm font-bold text-teal-600">₺85.00</div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                        <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                                            <span className="text-violet-600 text-lg">3</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">Su 500ml</div>
                                            <div className="text-xs text-slate-400">Stok: 120 adet</div>
                                        </div>
                                        <div className="text-sm font-bold text-teal-600">₺10.00</div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span className="text-sm text-slate-500">Toplam</span>
                                    <span className="text-xl font-extrabold text-slate-800">₺120.00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">Neden PosCebimde?</h2>
                    <p className="text-slate-500 max-w-2xl mx-auto">Her ölçekteki işletme için tasarlanmış, kullanımı kolay ve güçlü POS sistemi.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Feature 1 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Hızlı Satış</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Barkod okuyucu, hızlı arama ve tek tıkla satış ile kasada bekleme sürelerini minimuma indirin.</p>
                    </div>
                    {/* Feature 2 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Bulut Tabanlı</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Verileriniz güvende, her yerden erişilebilir. Bilgisayar, tablet veya telefonunuzdan anında bağlanın.</p>
                    </div>
                    {/* Feature 3 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Detaylı Raporlama</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Satış, stok ve müşteri verilerinizi anlık raporlarla takip edin. Excel'e kolayca aktarın.</p>
                    </div>
                    {/* Feature 4 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Bakiye & Cari Takip</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Müşteri bakiyelerini, veresiye ve tahsilat kayıtlarını otomatik olarak yönetin.</p>
                    </div>
                    {/* Feature 5 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Fiş & Fatura Yazdırma</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">Fiş tasarımlarını özelleştirin, e-fatura entegrasyonu ile yasal zorunlulukları kolayca karşılayın.</p>
                    </div>
                    {/* Feature 6 */}
                    <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Güvenli Altyapı</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">2FA doğrulama, rol bazlı yetkilendirme ve çalışan erişim saatleri ile verileriniz güvende.</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-3xl p-10 sm:p-14 text-center shadow-2xl shadow-teal-600/20">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">İşletmenizi Büyütmeye Hazır mısınız?</h2>
                    <p className="text-teal-100 max-w-xl mx-auto mb-8 leading-relaxed">
                        PosCebimde ile satışlarınızı hızlandırın, stok takibinizi otomatikleştirin ve müşteri memnuniyetinizi artırın.
                    </p>
                    {isAuthenticated ? (
                        <Link
                            to="/pos"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-700 font-bold rounded-2xl hover:bg-teal-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg group no-underline"
                        >
                            <span>Satış Ekranına Git</span>
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </Link>
                    ) : (
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-700 font-bold rounded-2xl hover:bg-teal-50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 shadow-lg group no-underline"
                        >
                            <span>Ücretsiz Hesap Oluştur</span>
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </Link>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo-v3.png" alt="PosCebimde" className="w-6 h-6 object-contain rounded-lg" />
                        <span className="text-sm font-bold text-slate-600">PosCebimde</span>
                    </div>
                    <p className="text-xs text-slate-400">&copy; 2026 PosCebimde. Tüm hakları saklıdır.</p>
                </div>
            </footer>
        </div>
    );
}
