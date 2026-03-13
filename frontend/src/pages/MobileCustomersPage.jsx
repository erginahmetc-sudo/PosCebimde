import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { customersAPI, productsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MobileCustomersPage() {
    const { logout } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Price Check Modal States
    const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
    const [priceCheckProduct, setPriceCheckProduct] = useState(null);
    const [priceCheckSearch, setPriceCheckSearch] = useState('');
    const [showPriceCheckScanner, setShowPriceCheckScanner] = useState(false);
    const priceCheckScannerRef = useRef(null);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                customersAPI.getAll(),
                productsAPI.getAll()
            ]);
            setCustomers(custRes.data?.customers || []);
            setProducts(prodRes.data?.products || []);
        } catch (error) {
            console.error('Veri yüklenirken hata:', error);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    const filteredCustomers = customers.filter(c => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm ||
            c.name?.toLowerCase().includes(searchLower) ||
            c.customer_code?.toLowerCase().includes(searchLower) ||
            c.phone?.includes(searchTerm);
    });

    // Calculate totals
    const totalDebt = customers.reduce((sum, c) => {
        const balance = parseFloat(c.balance) || 0;
        return balance > 0 ? sum + balance : sum;
    }, 0);

    const totalCredit = customers.reduce((sum, c) => {
        const balance = parseFloat(c.balance) || 0;
        return balance < 0 ? sum + Math.abs(balance) : sum;
    }, 0);

    return (
        <div className="flex flex-col w-screen h-screen bg-gray-100 overflow-hidden select-none relative">
            {/* Modern Loading Screen */}
            {loading && (
                <div className="absolute inset-0 z-[2000] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden transition-all duration-500">
                    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center animate-fade-in-up">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl animate-pulse-glow"></div>
                            <div className="relative w-24 h-24 flex items-center justify-center border border-slate-100 dark:border-slate-800 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-blue-600 font-extralight scale-125">
                                    account_balance_wallet
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-center leading-relaxed text-slate-900 dark:text-slate-100">
                            Bakiyeler <br />
                            <span className="font-medium">Yükleniyor</span>
                        </h1>
                        <p className="text-sm font-light text-slate-400 dark:text-slate-500 tracking-wider h-5 typewriter-cursor animate-typewriter">
                            Lütfen bekleyiniz...
                        </p>

                        <div className="w-full max-w-[280px] mt-12">
                            <div className="relative h-[2px] w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                <div className="absolute top-0 h-full bg-blue-600 animate-progress shadow-[0_0_10px_#2563eb]"></div>
                                <div className="absolute top-[-2px] h-[6px] bg-blue-600/30 blur-sm animate-progress w-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="min-h-screen bg-gray-100 pb-20">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10 px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                    <Link to="/mobile-pos" className="text-2xl">←</Link>
                    <h1 className="text-xl font-bold text-gray-800">Bakiyeler</h1>
                    <span className="ml-auto bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-semibold">
                        {customers.length}
                    </span>
                </div>

                {/* Summary Cards */}
                <div className="flex gap-2 mb-3">
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs text-red-600">Toplam Borç</p>
                        <p className="text-lg font-bold text-red-600">{totalDebt.toFixed(2)} TL</p>
                    </div>
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-green-600">Toplam Alacak</p>
                        <p className="text-lg font-bold text-green-600">{totalCredit.toFixed(2)} TL</p>
                    </div>
                </div>

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Müşteri ara..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
            </header>

            {/* Customer List */}
            <div className="p-4 space-y-3">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Müşteri bulunamadı.</div>
                ) : (
                    filteredCustomers.map(customer => {
                        const balance = parseFloat(customer.balance) || 0;
                        return (
                            <Link
                                key={customer.id}
                                to={`/customer/${encodeURIComponent(customer.name)}`}
                                className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4 no-underline"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {customer.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{customer.name}</h3>
                                    <p className="text-sm text-gray-500">{customer.customer_code || '-'}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {Math.abs(balance).toFixed(2)} TL
                                    </p>
                                    <p className={`text-xs ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                        {balance > 0 ? 'Borçlu' : balance < 0 ? 'Alacaklı' : 'Nötr'}
                                    </p>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 px-1">
                <Link to="/mobile-pos" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">🛒</span>
                    <span className="text-[10px]">Satış</span>
                </Link>
                <button onClick={() => { setShowPriceCheckModal(true); setPriceCheckProduct(null); setPriceCheckSearch(''); }} className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">💰</span>
                    <span className="text-[10px]">Fiyat Gör</span>
                </button>
                <Link to="/mobile-products" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📦</span>
                    <span className="text-[10px]">Ürünler</span>
                </Link>
                <Link to="/mobile-customers" className="flex flex-col items-center text-blue-600 min-w-[40px]">
                    <span className="text-lg">👥</span>
                    <span className="text-[10px] font-bold">Bakiyeler</span>
                </Link>
                <Link to="/mobile-sales" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📋</span>
                    <span className="text-[10px]">Satışlar</span>
                </Link>
                <Link to="/mobile-invoices" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📄</span>
                    <span className="text-[10px]">Faturalar</span>
                </Link>
                <button onClick={() => logout()} className="flex flex-col items-center text-red-500 min-w-[40px]">
                    <span className="text-lg">🚪</span>
                    <span className="text-[10px]">Çıkış</span>
                </button>
            </div>

            {/* Price Check Modal */}
            {showPriceCheckModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">💰 Fiyat Sorgula</h2>
                            <button onClick={() => { setShowPriceCheckModal(false); setPriceCheckProduct(null); if (priceCheckScannerRef.current) { priceCheckScannerRef.current.stop().catch(() => { }); priceCheckScannerRef.current = null; } setShowPriceCheckScanner(false); }} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            {!showPriceCheckScanner ? (
                                <button onClick={async () => { setShowPriceCheckScanner(true); setPriceCheckProduct(null); setTimeout(async () => { try { const scanner = new Html5Qrcode('customers-price-scanner'); priceCheckScannerRef.current = scanner; await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } }, (decodedText) => { const found = products.find(p => p.barcode === decodedText || p.stock_code === decodedText); if (found) setPriceCheckProduct(found); else setPriceCheckProduct({ notFound: true, searchTerm: decodedText }); scanner.stop().catch(() => { }); priceCheckScannerRef.current = null; setShowPriceCheckScanner(false); }, () => { }); } catch (err) { setShowPriceCheckScanner(false); } }, 100); }} className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl font-bold text-lg">📷 Barkod Okut</button>
                            ) : (
                                <div className="space-y-3">
                                    <div id="customers-price-scanner" className="w-full rounded-2xl overflow-hidden"></div>
                                    <button onClick={() => { if (priceCheckScannerRef.current) { priceCheckScannerRef.current.stop().catch(() => { }); priceCheckScannerRef.current = null; } setShowPriceCheckScanner(false); }} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold">İptal</button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input type="text" value={priceCheckSearch} onChange={(e) => setPriceCheckSearch(e.target.value)} placeholder="Stok Kodu veya Barkod..." className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl" onKeyDown={(e) => { if (e.key === 'Enter' && priceCheckSearch.trim()) { const found = products.find(p => p.barcode === priceCheckSearch.trim() || p.stock_code === priceCheckSearch.trim()); setPriceCheckProduct(found || { notFound: true, searchTerm: priceCheckSearch.trim() }); } }} />
                                <button onClick={() => { if (priceCheckSearch.trim()) { const found = products.find(p => p.barcode === priceCheckSearch.trim() || p.stock_code === priceCheckSearch.trim()); setPriceCheckProduct(found || { notFound: true, searchTerm: priceCheckSearch.trim() }); } }} className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold">Ara</button>
                            </div>
                            {priceCheckProduct && (
                                <div className="mt-4">
                                    {priceCheckProduct.notFound ? (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                                            <span className="text-4xl">❌</span>
                                            <p className="text-lg font-semibold text-red-600 mt-2">Ürün Bulunamadı</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                                            <div className="text-center"><p className="text-lg font-bold text-gray-800">{priceCheckProduct.name}</p></div>
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-500">Stok Kodu</p><p className="font-semibold">{priceCheckProduct.stock_code}</p></div>
                                                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-500">Barkod</p><p className="font-semibold font-mono text-sm">{priceCheckProduct.barcode || '-'}</p></div>
                                            </div>
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center">
                                                <p className="text-emerald-100 text-sm mb-1">Satış Fiyatı</p>
                                                <p className="text-4xl font-black text-white">{priceCheckProduct.price?.toFixed(2)} TL</p>
                                            </div>
                                            <button onClick={() => { setPriceCheckProduct(null); setPriceCheckSearch(''); }} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold">🔄 Yeni Arama</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.8s ease-out;
                }
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 3s infinite ease-in-out;
                }
                @keyframes progress {
                    0% { left: -100%; width: 100%; }
                    100% { left: 100%; width: 100%; }
                }
                .animate-progress {
                    animation: progress 2s infinite linear;
                }
                @keyframes typewriter {
                    0%, 100% { opacity: 0; }
                    50% { opacity: 1; }
                }
                .animate-typewriter {
                    animation: typewriter 1s infinite;
                }
            `}</style>
        </div>
        </div>
    );
}
