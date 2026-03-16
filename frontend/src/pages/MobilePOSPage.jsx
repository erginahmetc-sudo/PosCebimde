import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI, settingsAPI, heldSalesAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';
import { useAuth } from '../context/AuthContext';
import StatusModal from '../components/modals/StatusModal';

export default function MobilePOSPage() {
    const { user, logout } = useAuth();
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [shortcuts, setShortcuts] = useState([]);
    const [categories, setCategories] = useState(['Tümü']);
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState('Toptan Satış');

    // Modal states
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [showAddQuantityModal, setShowAddQuantityModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
    const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
    const [priceCheckProduct, setPriceCheckProduct] = useState(null);
    const [priceCheckSearch, setPriceCheckSearch] = useState('');
    const [showPriceCheckScanner, setShowPriceCheckScanner] = useState(false);
    const priceCheckScannerRef = useRef(null);
    const [showUndefinedStockModal, setShowUndefinedStockModal] = useState(false);
    const [undefinedStockName, setUndefinedStockName] = useState('');
    const [undefinedStockPrice, setUndefinedStockPrice] = useState('');
    const [undefinedStockQuantity, setUndefinedStockQuantity] = useState(1);
    const [undefinedStockStep, setUndefinedStockStep] = useState(1);
    const [heldSales, setHeldSales] = useState([]);
    const [showWaitlistModal, setShowWaitlistModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const [modalValue, setModalValue] = useState('');
    const [productToAdd, setProductToAdd] = useState(null);
    const [addQuantityValue, setAddQuantityValue] = useState(1);
    const [successMessage, setSuccessMessage] = useState('');
    const [scannerError, setScannerError] = useState('');

    // Barcode scanner refs
    const html5QrCodeRef = useRef(null);
    const scannerContainerRef = useRef(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const lastScannedRef = useRef('');

    // Retail Customer (Perakende Müşteri) States
    const [showRetailCustomerModal, setShowRetailCustomerModal] = useState(false);
    const defaultRetailForm = {
        name: '',
        address: 'Fatih mh.',
        phone: '',
        email: '',
        tax_office: '',
        tax_number: '11111111111',
        city: 'Adana',
        district: 'Seyhan'
    };
    const [retailCustomerForm, setRetailCustomerForm] = useState(defaultRetailForm);
    const [retailPaymentType, setRetailPaymentType] = useState('Kredi Kartı');
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [taxPayerLoading, setTaxPayerLoading] = useState(false);
    const [taxPayerResult, setTaxPayerResult] = useState(null);
    const [taxOffices, setTaxOffices] = useState([]);
    const [taxOfficeSearch, setTaxOfficeSearch] = useState('');
    const [showTaxOfficeDropdown, setShowTaxOfficeDropdown] = useState(false);
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'error', details: null, actionButton: null });

    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadShortcuts();
        loadHeldSales();
    }, []);

    const loadHeldSales = async () => {
        try {
            const response = await heldSalesAPI.getAll();
            setHeldSales(response.data?.held_sales || []);
        } catch (error) {
            console.error('Bekleyen satışlar yüklenirken hata:', error);
        }
    };

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            const data = response.data || {};
            setProducts(data.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        } finally {
            setTimeout(() => setLoading(false), 500);
        }
    };

    const loadCustomers = async () => {
        try {
            const response = await customersAPI.getAll();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        }
    };

    const loadShortcuts = async () => {
        try {
            const res = await shortcutsAPI.getAll();
            const list = res.data?.shortcuts || [];
            setShortcuts(list);
            setCategories(['Tümü', ...list.map(s => s.name)]);
        } catch (err) {
            console.error('Kısayollar yüklenirken hata:', err);
        }
    };

    // Load tax offices for retail customer form
    useEffect(() => {
        const loadTaxOffices = async () => {
            const cached = sessionStorage.getItem('birfatura_tax_offices');
            if (cached) {
                try { setTaxOffices(JSON.parse(cached)); return; } catch (e) {}
            }
            const result = await birFaturaAPI.getTaxOffices();
            if (result.success && result.data) {
                setTaxOffices(result.data);
                sessionStorage.setItem('birfatura_tax_offices', JSON.stringify(result.data));
            }
        };
        loadTaxOffices();
    }, []);

    const filteredTaxOffices = useMemo(() => {
        const search = (taxOfficeSearch || retailCustomerForm.tax_office || '').toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
        if (!search || search.length < 2) return [];
        return taxOffices.filter(o => {
            const name = (o.TaxOfficeName || '').toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
            return name.includes(search);
        }).slice(0, 10);
    }, [taxOfficeSearch, retailCustomerForm.tax_office, taxOffices]);

    const handleRetailCustomerChange = (e) => {
        const { name, value } = e.target;
        setRetailCustomerForm(prev => ({ ...prev, [name]: value }));
        if (name === 'tax_number') {
            setTaxPayerResult(null);
        }
    };

    const handleRetailCustomerSubmit = (e) => {
        if (e) e.preventDefault();
        if (!retailCustomerForm.name.trim()) return alert('İsim Soyisim zorunludur!');
        setSelectedCustomer(`Perakende-${retailCustomerForm.name.trim()}`);
        setShowRetailCustomerModal(false);
        setShowCustomerModal(false);
    };

    const handleTaxPayerQuery = async () => {
        const taxNo = retailCustomerForm.tax_number.trim();
        if (taxNo.length < 10) return;
        setTaxPayerLoading(true);
        setTaxPayerResult(null);
        const result = await birFaturaAPI.queryTaxPayer(taxNo);
        setTaxPayerLoading(false);
        if (result.success && result.data) {
            const title = result.data.title || result.data.name || '';
            setRetailCustomerForm(prev => ({ ...prev, name: title || prev.name }));
            setTaxPayerResult({ isEFatura: true, title });
        } else if (result.success && !result.data) {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        } else {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        }
    };

    const paymentTypeMap = {
        'Nakit': 'Nakit olarak Ödendi',
        'Kredi Kartı': 'Kredi Kartı ile Ödendi',
        'Havale': 'Havale-EFT ile ödendi'
    };

    const handleDirectInvoice = async () => {
        if (!retailCustomerForm.name.trim()) {
            setStatusModal({ isOpen: true, title: 'Hata', message: 'İsim Soyisim zorunludur!', type: 'error', details: null });
            return;
        }
        if (cart.length === 0) {
            setStatusModal({ isOpen: true, title: 'Hata', message: 'Sepet boş! Önce ürün ekleyin.', type: 'error', details: null });
            return;
        }
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            setStatusModal({ isOpen: true, title: 'Entegrasyon Ayarı Yok', message: 'Ayarlar sayfasından BirFatura API anahtarlarını kaydedin.', type: 'error', details: null });
            return;
        }

        setInvoiceLoading(true);
        try {
            const saleCode = 'SLS-' + Date.now();
            const birFaturaPaymentText = paymentTypeMap[retailPaymentType] || '';
            const result = await birFaturaAPI.sendBasicInvoice({
                retailForm: retailCustomerForm,
                cart,
                paymentMethod: birFaturaPaymentText,
                saleCode
            });

            if (result.success) {
                const perakendeCustomerName = `Perakende-${retailCustomerForm.name.trim()}`;
                setSelectedCustomer(perakendeCustomerName);
                setShowRetailCustomerModal(false);
                setShowCustomerModal(false);
                const invoiceUuid = result.ettn || result.data?.Result?.ETTN || result.data?.result?.ETTN || result.data?.Result?.UUID || result.data?.result?.UUID || null;
                let pdfUrl = result.data?.Result?.PdfUrl || result.data?.result?.pdfUrl || null;

                try {
                    const selectedCust = customers.find(c => c.name === perakendeCustomerName);
                    await salesAPI.complete({
                        sale_code: saleCode,
                        customer: selectedCust || null,
                        customer_name: !selectedCust ? perakendeCustomerName : undefined,
                        tax_number: retailCustomerForm.tax_number,
                        address: retailCustomerForm.address,
                        phone: retailCustomerForm.phone,
                        payment_method: retailPaymentType,
                        items: cart.map(item => ({
                            id: item.id, stock_code: item.stock_code, barcode: item.barcode, name: item.name,
                            quantity: item.quantity, price: item.price || item.final_price, discount_rate: item.discount_rate || 0,
                            amount: item.quantity
                        })),
                        total: calculateTotal()
                    });

                    setCart([]);
                    setSelectedCustomer('Toptan Satış');
                    setRetailCustomerForm(defaultRetailForm);
                    setRetailPaymentType('Kredi Kartı');
                    setShowCartModal(false);
                    loadProducts();
                } catch (error) {
                    console.error('[MobilePOS] Satış kaydetme hatası:', error);
                }

                setStatusModal({
                    isOpen: true,
                    title: 'Fatura Gönderildi ✓',
                    message: 'E-Fatura/E-Arşiv fatura başarıyla gönderildi ve satış tamamlandı.',
                    type: 'success',
                    details: null,
                    actionButton: (pdfUrl || invoiceUuid) ? {
                        label: '📄 Kesilen Faturayı Görüntüle',
                        onClick: async () => {
                            if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
                            try {
                                const pdfResult = await birFaturaAPI.getPdfLink(invoiceUuid);
                                if (pdfResult.success && pdfResult.pdfUrl) {
                                    window.open(pdfResult.pdfUrl, '_blank');
                                } else {
                                    alert('PDF henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.');
                                }
                            } catch (err) {
                                console.error('[MobilePOS] PDF açma hatası:', err);
                                alert('PDF alınırken hata oluştu.');
                            }
                        }
                    } : null
                });
                setSuccessMessage('Satış İşlemi Başarılı');
                setTimeout(() => setSuccessMessage(''), 2000);
            } else {
                setStatusModal({ isOpen: true, title: 'Fatura Hatası', message: result.message, type: 'error', details: null });
            }
        } catch (error) {
            console.error('[MobilePOS] Fatura kesme işlemi başarısız:', error);
            setStatusModal({ 
                isOpen: true, 
                title: 'İşlem Hatası', 
                message: 'Fatura kesme işlemi sırasında beklenmedik bir hata oluştu: ' + error.message, 
                type: 'error', 
                details: null 
            });
        } finally {
            setInvoiceLoading(false);
        }
    };

    const filteredProducts = (() => {
        const currentGroup = selectedCategory !== 'Tümü'
            ? shortcuts.find(s => s.name === selectedCategory)
            : null;
        const groupItems = currentGroup?.items || [];

        let result = products.filter(p => {
            let matchesCategory = true;
            if (selectedCategory !== 'Tümü') {
                matchesCategory = groupItems.includes(p.stock_code);
            }

            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                p.name?.toLowerCase().includes(searchLower) ||
                p.barcode?.toLowerCase().includes(searchLower) ||
                p.stock_code?.toLowerCase().includes(searchLower);
            return matchesCategory && matchesSearch;
        });

        if (selectedCategory !== 'Tümü' && groupItems.length > 0) {
            result.sort((a, b) => {
                const idxA = groupItems.indexOf(a.stock_code);
                const idxB = groupItems.indexOf(b.stock_code);
                return idxA - idxB;
            });
        }

        return result;
    })();

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        c.phone?.includes(customerSearchTerm)
    );

    const handleProductClick = (product) => {
        setProductToAdd(product);
        setAddQuantityValue(1);
        setShowAddQuantityModal(true);
    };

    const confirmAddToCart = () => {
        if (!productToAdd) return;
        const quantity = parseFloat(addQuantityValue) || 1;

        const existingIndex = cart.findIndex(item => item.stock_code === productToAdd.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
        } else {
            setCart([...cart, { ...productToAdd, quantity: quantity, discount_rate: 0, final_price: productToAdd.price }]);
        }
        setShowAddQuantityModal(false);
        setProductToAdd(null);
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
        if (field === 'discount_rate') {
            newCart[index].final_price = newCart[index].price * (1 - value / 100);
        } else if (field === 'price') {
            newCart[index].final_price = value * (1 - (newCart[index].discount_rate || 0) / 100);
        }
        setCart(newCart);
        setShowQuantityModal(false);
        setShowDiscountModal(false);
        setShowPriceModal(false);
    };

    const removeFromCart = (index) => {
        setCart(cart.filter((_, i) => i !== index));
        setSelectedCartIndex(null);
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            return sum + (item.final_price * item.quantity);
        }, 0);
    };

    const completeSale = async (paymentMethod) => {
        if (cart.length === 0) {
            alert('Sepet boş!');
            return;
        }

        if (paymentMethod === 'Açık Hesap' && selectedCustomer === 'Toptan Satış') {
            alert('Açık hesap için bir müşteri seçmelisiniz.');
            return;
        }

        try {
            const saleCode = 'SLS-' + Date.now();
            const selectedCustomerObj = customers.find(c => c.name === selectedCustomer);

            await salesAPI.complete({
                sale_code: saleCode,
                customer: selectedCustomerObj || null,
                customer_name: !selectedCustomerObj ? selectedCustomer : undefined,
                payment_method: paymentMethod,
                items: cart.map(item => ({
                    id: item.id,
                    stock_code: item.stock_code,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.final_price,
                    discount_rate: item.discount_rate || 0,
                    amount: item.quantity
                })),
                total: calculateTotal()
            });

            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setSelectedCustomer('Toptan Satış');
            setShowCartModal(false);
            loadProducts();
        } catch (error) {
            alert('Satış hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const holdSale = async () => {
        if (cart.length === 0) {
            alert('Sepet boş!');
            return;
        }
        try {
            await heldSalesAPI.add({ customer: selectedCustomer, items: cart });
            setSuccessMessage('Satış Beklemeye Alındı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setSelectedCustomer('Toptan Satış');
            loadHeldSales();
        } catch (error) {
            alert('Beklemeye alma hatası: ' + (error.response?.data?.message || error.message || 'Bilinmeyen hata'));
        }
    };

    const restoreHeldSale = async (sale) => {
        setCart(sale.items || []);
        setSelectedCustomer(sale.customer_name || 'Toptan Satış');
        try {
            await heldSalesAPI.delete(sale.id);
            loadHeldSales();
        } catch (error) {
            console.error('Bekleyen satış silme hatası:', error);
        }
        setShowWaitlistModal(false);
    };

    const deleteHeldSale = async (saleId) => {
        try {
            await heldSalesAPI.delete(saleId);
            loadHeldSales();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    // Barcode scanner functions
    const addProductByBarcode = useCallback((barcode) => {
        const product = products.find(p =>
            p.barcode === barcode ||
            p.stock_code === barcode ||
            p.stock_code?.toLowerCase() === barcode.toLowerCase()
        );

        if (product) {
            // Add to cart directly with quantity 1
            const existingIndex = cart.findIndex(item => item.stock_code === product.stock_code);
            if (existingIndex >= 0) {
                const newCart = [...cart];
                newCart[existingIndex].quantity += 1;
                setCart(newCart);
            } else {
                setCart(prev => [...prev, { ...product, quantity: 1, discount_rate: 0, final_price: product.price }]);
            }
            setSuccessMessage(`${product.name} eklendi!`);
            setTimeout(() => setSuccessMessage(''), 1500);
            return true;
        } else {
            setScannerError(`Barkod bulunamadı: ${barcode}`);
            setTimeout(() => setScannerError(''), 3000);
            return false;
        }
    }, [products, cart]);

    const startBarcodeScanner = async () => {
        setScannerError('');
        setShowBarcodeScanner(true);
        lastScannedRef.current = '';

        // Wait for DOM to render
        setTimeout(async () => {
            try {
                const html5QrCode = new Html5Qrcode('barcode-scanner-container');
                html5QrCodeRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 150 },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        // Prevent duplicate scans
                        if (decodedText !== lastScannedRef.current) {
                            lastScannedRef.current = decodedText;
                            console.log('Barkod bulundu:', decodedText);
                            addProductByBarcode(decodedText);

                            // Reset after 2 seconds to allow same barcode again
                            setTimeout(() => {
                                lastScannedRef.current = '';
                            }, 2000);
                        }
                    },
                    (errorMessage) => {
                        // Ignore scanning errors (normal when no barcode in view)
                    }
                );
            } catch (err) {
                console.error('Kamera başlatma hatası:', err);
                setScannerError('Kamera açılamadı. Lütfen kamera izni verin.');
            }
        }, 100);
    };

    const stopBarcodeScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (err) {
                console.error('Scanner stop error:', err);
            }
            html5QrCodeRef.current = null;
        }

        setShowBarcodeScanner(false);
        setScannerError('');
    };

    return (
        <div className="flex flex-col w-full h-[100dvh] bg-gray-100 overflow-hidden select-none relative">
            {/* Modern Loading Screen */}
            {loading && (
                <div className="absolute inset-0 z-[2000] bg-gradient-to-b from-white to-slate-50 flex flex-col items-center justify-center overflow-hidden transition-all duration-500">
                    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center animate-fade-in-up">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-blue-600/10 rounded-full blur-2xl animate-pulse-glow"></div>
                            <div className="relative w-24 h-24 flex items-center justify-center border border-slate-200 rounded-full bg-white shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-blue-600 font-extralight scale-125">
                                    shopping_bag
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-center leading-relaxed text-slate-800">
                            Satış <br />
                            <span className="font-medium">Yükleniyor</span>
                        </h1>
                        <p className="text-sm font-light text-slate-400 tracking-wider h-5 typewriter-cursor animate-typewriter">
                            Lütfen bekleyiniz...
                        </p>

                        <div className="w-full max-w-[280px] mt-12">
                            <div className="relative h-[2px] w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="absolute top-0 h-full bg-blue-600 animate-progress shadow-[0_0_10px_#2563eb]"></div>
                                <div className="absolute top-[-2px] h-[6px] bg-blue-600/20 blur-sm animate-progress w-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Success Message */}
            {successMessage && (
                <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
                    <div className="bg-green-500 text-white px-16 py-8 rounded-xl shadow-2xl text-3xl font-bold animate-pulse">
                        {successMessage}
                    </div>
                </div>
            )}

            {/* Side Menu */}
            <div
                className={`fixed top-0 left-0 h-full bg-slate-800 z-[1001] transition-all duration-500 overflow-hidden flex flex-col gap-2 pt-16 shadow-xl ${showSideMenu ? 'w-64' : 'w-0'}`}
            >
                <button
                    onClick={() => setShowSideMenu(false)}
                    className="absolute top-2 right-4 text-4xl text-white bg-transparent border-none cursor-pointer"
                >
                    &times;
                </button>
                <Link to="/" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    🏠 Ana Sayfa
                </Link>
                <Link to="/customers" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    👥 Müşterileri Gör
                </Link>
                <Link to="/sales" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    📊 Satışları Gör
                </Link>
                <Link to="/products" className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors no-underline">
                    📦 Ürünleri Gör
                </Link>
                <button
                    onClick={() => { logout(); setShowSideMenu(false); }}
                    className="mt-4 px-8 py-4 text-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors border-t border-slate-700 text-left"
                >
                    🚪 Çıkış
                </button>
            </div>

            {/* Header */}
            <header className="flex justify-between items-center p-2 bg-white shadow-md gap-2">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ürün Ara"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                    onClick={holdSale}
                    className="bg-orange-400 text-white border-none rounded-lg px-2.5 py-2 text-[10px] font-bold cursor-pointer hover:bg-orange-500 transition-colors whitespace-nowrap"
                >
                    Beklemeye Al
                </button>
                <button
                    onClick={() => setShowWaitlistModal(true)}
                    className="bg-slate-500 text-white border-none rounded-lg px-2.5 py-2 text-[10px] font-bold cursor-pointer hover:bg-slate-600 transition-colors whitespace-nowrap"
                >
                    Bekleme Listesi
                </button>
                <button
                    onClick={() => setShowUndefinedStockModal(true)}
                    className="bg-orange-500 text-white border-none rounded-lg px-2.5 py-2 text-[10px] font-bold cursor-pointer hover:bg-orange-600 transition-colors whitespace-nowrap"
                >
                    Tanımsız
                </button>
                <button
                    onClick={startBarcodeScanner}
                    className="bg-blue-50 text-blue-600 border-none rounded-lg p-2 text-2xl cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
                >
                    📷
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
                {/* Category Buttons */}
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-4 mb-2 scroll-smooth no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', minHeight: '60px' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex-shrink-0 bg-white border-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition-all
                                ${selectedCategory === cat
                                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                                    : 'border-gray-300 hover:border-blue-500 hover:text-blue-500'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 content-start pb-36">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id || product.stock_code}
                            onClick={() => handleProductClick(product)}
                            className="bg-white border border-gray-200 rounded-xl px-1.5 pt-1.5 pb-0 text-center cursor-pointer transition-all hover:shadow-lg flex flex-col h-[140px] overflow-hidden"
                        >
                            <div className="flex-1 flex flex-col items-center pt-0.5 overflow-hidden">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-16 object-contain rounded-md mb-1" />
                                ) : (
                                    <div className="w-full h-16 flex items-center justify-center text-3xl text-gray-300 mb-1">📦</div>
                                )}
                                <div className="text-[11px] font-bold leading-tight line-clamp-2 px-0.5 text-gray-800">
                                    {product.name}
                                </div>
                            </div>
                            <div className="text-green-600 text-base font-black py-1 border-t border-gray-100 flex items-center justify-center bg-gray-50/80 -mx-1.5">
                                {product.price?.toFixed(2)} TL
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Navigation Menu Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white z-[500]">
                {/* Top row: Total and Cart */}
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
                    <span className="text-xl font-bold text-green-600">{calculateTotal().toFixed(2)} TL</span>
                    <button
                        onClick={() => setShowCartModal(true)}
                        className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none rounded-xl px-5 py-2 text-base font-bold cursor-pointer hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        🛒 <span>{cart.length}</span> Sepete Git
                    </button>
                </div>

                {/* Bottom row: Navigation buttons */}
                <div className="border-t border-gray-200 flex justify-around py-2 px-1">
                    <Link to="/mobile-pos" className="flex flex-col items-center text-blue-600 min-w-[40px]">
                        <span className="text-lg">🛒</span>
                        <span className="text-[10px] font-bold">Satış</span>
                    </Link>
                    <button onClick={() => { setShowPriceCheckModal(true); setPriceCheckProduct(null); setPriceCheckSearch(''); }} className="flex flex-col items-center text-gray-600 min-w-[40px]">
                        <span className="text-lg">💰</span>
                        <span className="text-[10px]">Fiyat Gör</span>
                    </button>
                    <Link to="/mobile-products" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                        <span className="text-lg">📦</span>
                        <span className="text-[10px]">Ürünler</span>
                    </Link>
                    <Link to="/mobile-customers" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                        <span className="text-lg">👥</span>
                        <span className="text-[10px]">Bakiyeler</span>
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
            </div>

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 bg-white z-[1000] flex flex-col">
                    {/* Modal Header - Fixed at top */}
                    <div className="flex justify-between items-center p-4 bg-white border-b border-gray-200 shrink-0">
                        <h3 className="text-2xl font-bold text-slate-800 m-0">Sepetim</h3>
                        <div className="flex-1 text-center font-bold text-blue-600 truncate mx-4">
                            {selectedCustomer}
                        </div>
                        <button
                            onClick={() => setShowCartModal(false)}
                            className="bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-200"
                        >
                            Geri Dön
                        </button>
                    </div>

                    {/* Cart List - Scrollable area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Sepetinizde ürün bulunmamaktadır.</div>
                        ) : (
                            cart.map((item, index) => (
                                <div
                                    key={index}
                                    onClick={() => setSelectedCartIndex(index)}
                                    className={`flex justify-between items-center py-3 px-3 cursor-pointer rounded-lg mb-2 transition-colors shadow-sm
                                        ${selectedCartIndex === index ? 'bg-green-200 border-2 border-green-400' : 'bg-yellow-50 border border-gray-200'}`}
                                >
                                    <div className="flex-1">
                                        <h4 className="m-0 mb-1 text-base font-semibold">{item.name}</h4>
                                        <p className="m-0 text-sm text-gray-600 flex items-center gap-1">
                                            <span className="text-blue-600 font-bold">{item.quantity}</span>
                                            <span className="font-black">Adet x</span>
                                            <span className="text-blue-600 font-bold">{item.final_price?.toFixed(2)} TL</span>
                                        </p>
                                    </div>
                                    <div className="font-bold text-green-600 text-lg w-24 text-right">
                                        {(item.final_price * item.quantity).toFixed(2)} TL
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                                        className="ml-3 bg-red-500 text-white border-none rounded-full w-9 h-9 text-lg cursor-pointer flex items-center justify-center hover:bg-red-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Bottom Fixed Section - All buttons */}
                    <div className="shrink-0 bg-white border-t-2 border-gray-300 p-4">
                        {/* Edit Buttons */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].quantity);
                                        setShowQuantityModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-green-500 text-white hover:bg-green-600 disabled:hover:bg-gray-200"
                            >
                                Miktar Düzenle
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].discount_rate || 0);
                                        setShowDiscountModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-yellow-500 text-white hover:bg-yellow-600 disabled:hover:bg-gray-200"
                            >
                                İskonto Ekle
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                        setModalValue(cart[selectedCartIndex].price);
                                        setShowPriceModal(true);
                                    }
                                }}
                                disabled={selectedCartIndex === null}
                                className="py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed bg-cyan-500 text-white hover:bg-cyan-600 disabled:hover:bg-gray-200"
                            >
                                Fiyat Düzenle
                            </button>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center bg-yellow-300 rounded-lg p-4 mb-3">
                            <span className="text-lg">Genel Toplam</span>
                            <span className="text-2xl font-bold">{calculateTotal().toFixed(2)} TL</span>
                        </div>

                        {/* Customer Select Button */}
                        <button
                            onClick={() => setShowCustomerModal(true)}
                            className="w-full py-3 bg-cyan-400 text-white rounded-lg font-semibold cursor-pointer hover:bg-cyan-500 transition-colors mb-3"
                        >
                            Müşteri Seç
                        </button>

                        {/* Payment Buttons */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => completeSale('Nakit')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-green-500 hover:bg-green-600 disabled:opacity-50"
                            >
                                Nakit
                            </button>
                            <button
                                onClick={() => completeSale('POS')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                            >
                                POS
                            </button>
                            <button
                                onClick={() => completeSale('Açık Hesap')}
                                disabled={cart.length === 0}
                                className="py-4 rounded-lg font-semibold text-white cursor-pointer transition-colors bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                            >
                                Açık Hesap
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Quantity Modal */}
            {showAddQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowAddQuantityModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">Miktar Girin</h3>
                        <p className="text-gray-600 mb-4 text-center text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">{productToAdd?.name}</p>
                        <input
                            type="number"
                            value={addQuantityValue}
                            onChange={(e) => setAddQuantityValue(e.target.value)}
                            className="w-full p-4 text-4xl font-black text-center border-2 border-blue-500 rounded-xl mb-4 focus:outline-none bg-slate-50"
                            min="1"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={confirmAddToCart}
                            className="w-full py-4 bg-green-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
                        >
                            Sepete Ekle
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Quantity Modal */}
            {showQuantityModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowQuantityModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">Miktar Düzenle</h3>
                        <p className="text-gray-600 mb-4 text-center text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-4xl font-black text-center border-2 border-blue-500 rounded-xl mb-4 focus:outline-none bg-slate-50"
                            min="1"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowDiscountModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">İskonto Ekle (%)</h3>
                        <p className="text-gray-600 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="0"
                            max="100"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => setShowPriceModal(false)}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Fiyat Düzenle</h3>
                        <p className="text-gray-600 mb-4">{cart[selectedCartIndex]?.name}</p>
                        <input
                            type="number"
                            step="0.01"
                            value={modalValue}
                            onChange={(e) => setModalValue(e.target.value)}
                            className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg mb-4 focus:outline-none"
                            min="0"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0)}
                            className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Customer Search Modal - Enhanced with Perakende Müşteri */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[1000]">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up sm:animate-none">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-5 py-4 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-white">Müşteri Seç</h3>
                            <button onClick={() => setShowCustomerModal(false)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-3 bg-slate-50 border-b shrink-0">
                            <input
                                type="text"
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                placeholder="Müşteri ara..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                autoFocus
                            />
                        </div>

                        {/* Customer List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {/* Perakende Müşteri Option */}
                            <div
                                onClick={() => { setShowRetailCustomerModal(true); setTaxPayerResult(null); setRetailCustomerForm(defaultRetailForm); }}
                                className="p-4 bg-amber-50 border border-amber-200 rounded-xl hover:border-amber-500 hover:bg-amber-100 cursor-pointer flex justify-between items-center group transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white shrink-0">
                                        <span className="material-symbols-outlined">person_pin</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-amber-900 block text-sm">Perakende Müşteri</span>
                                        <span className="text-xs text-amber-700">Adres ve TC Kimlik bilgileri ile</span>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-amber-300 group-hover:text-amber-600 transition-colors">arrow_forward_ios</span>
                            </div>

                            {/* Toptan Satış (Default) */}
                            <div
                                onClick={() => { setSelectedCustomer('Toptan Satış'); setShowCustomerModal(false); }}
                                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group transition-colors"
                            >
                                <span className="font-bold text-slate-800 text-sm">Toptan Satış (Varsayılan)</span>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500">check_circle</span>
                            </div>

                            {/* Registered Customers */}
                            {filteredCustomers.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => { setSelectedCustomer(c.name); setShowCustomerModal(false); }}
                                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group transition-colors"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                                        <p className="text-xs text-slate-500">{c.phone || ''}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-sm ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{c.balance?.toFixed(2)} ₺</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Retail Customer Modal - Mobile Responsive */}
            {showRetailCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[1100]">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up sm:animate-none">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                                        <span className="text-lg">👤</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white tracking-tight">Perakende Müşteri</h3>
                                        <p className="text-slate-400 text-xs">Hızlı satış için bilgileri doldurun</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowRetailCustomerModal(false)} className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Form Content - Single Column for Mobile */}
                        <form onSubmit={handleRetailCustomerSubmit} className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-slate-50 to-white">
                            <div className="space-y-3">
                                {/* İsim Soyisim */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700">
                                        İsim Soyisim <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={retailCustomerForm.name}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Müşteri adını giriniz..."
                                        required
                                        autoFocus
                                    />
                                </div>

                                {/* TC / Vergi No + Müşteriyi Getir */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700">
                                        TC Kimlik / Vergi Numarası
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="tax_number"
                                            value={retailCustomerForm.tax_number}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                setRetailCustomerForm(prev => ({ ...prev, tax_number: val }));
                                                setTaxPayerResult(null);
                                            }}
                                            maxLength={11}
                                            className="flex-1 px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider"
                                            placeholder="VKN (10) veya TCKN (11)"
                                        />
                                        {retailCustomerForm.tax_number.trim().length >= 10 && (
                                            <button
                                                type="button"
                                                onClick={handleTaxPayerQuery}
                                                disabled={taxPayerLoading}
                                                className="px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                                            >
                                                {taxPayerLoading ? (
                                                    <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Sorgu</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-sm">person_search</span> Getir</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    {taxPayerResult && (
                                        <div className={`mt-1 px-3 py-2 rounded-lg text-xs font-medium ${
                                            taxPayerResult.isEFatura
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            {taxPayerResult.isEFatura ? (
                                                <><span className="material-symbols-outlined text-sm align-middle mr-1">verified</span> e-Fatura Mükellefi: {taxPayerResult.title}</>
                                            ) : (
                                                <><span className="material-symbols-outlined text-sm align-middle mr-1">info</span> {taxPayerResult.message}</>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Telefon & E-posta - 2 columns on wider mobile */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700">Telefon</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={retailCustomerForm.phone}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="0532 xxx xx xx"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700">E-posta</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={retailCustomerForm.email}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="ornek@email.com"
                                        />
                                    </div>
                                </div>

                                {/* Vergi Dairesi */}
                                <div className="space-y-1 relative">
                                    <label className="block text-xs font-semibold text-slate-700">
                                        Vergi Dairesi
                                        {retailCustomerForm.tax_number.replace(/\D/g, '').length === 11 && (
                                            <span className="text-xs text-slate-400 font-normal ml-1">(TCKN için gerekli değil)</span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="tax_office"
                                        value={retailCustomerForm.tax_number.replace(/\D/g, '').length === 11 ? '' : retailCustomerForm.tax_office}
                                        onChange={(e) => {
                                            handleRetailCustomerChange(e);
                                            setTaxOfficeSearch(e.target.value);
                                            setShowTaxOfficeDropdown(true);
                                        }}
                                        onFocus={() => { if (retailCustomerForm.tax_number.replace(/\D/g, '').length !== 11) setShowTaxOfficeDropdown(true); }}
                                        onBlur={() => setTimeout(() => setShowTaxOfficeDropdown(false), 200)}
                                        autoComplete="off"
                                        disabled={retailCustomerForm.tax_number.replace(/\D/g, '').length === 11}
                                        className={`w-full px-3 py-2.5 text-sm rounded-xl border-2 outline-none transition-all placeholder:text-slate-400 ${
                                            retailCustomerForm.tax_number.replace(/\D/g, '').length === 11
                                                ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                                                : 'border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500'
                                        }`}
                                        placeholder={retailCustomerForm.tax_number.replace(/\D/g, '').length === 11 ? 'TCKN için gerekli değil' : 'Vergi dairesi adı yazın...'}
                                    />
                                    {showTaxOfficeDropdown && filteredTaxOffices.length > 0 && retailCustomerForm.tax_number.replace(/\D/g, '').length !== 11 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                            {filteredTaxOffices.map((office, idx) => (
                                                <div
                                                    key={office.TaxOfficeCode || idx}
                                                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                                                    onMouseDown={() => {
                                                        setRetailCustomerForm(prev => ({ ...prev, tax_office: office.TaxOfficeName }));
                                                        setShowTaxOfficeDropdown(false);
                                                        setTaxOfficeSearch('');
                                                    }}
                                                >
                                                    <span className="font-medium text-slate-700 text-xs">{office.TaxOfficeName}</span>
                                                    <span className="text-slate-400 ml-1 text-xs">({office.TaxOfficeCode})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Adres */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700">Adres</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={retailCustomerForm.address}
                                        onChange={handleRetailCustomerChange}
                                        className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Adres bilgisi..."
                                    />
                                </div>

                                {/* İl & İlçe */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700">İl</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={retailCustomerForm.city}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Adana"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs font-semibold text-slate-700">İlçe</label>
                                        <input
                                            type="text"
                                            name="district"
                                            value={retailCustomerForm.district}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-3 py-2.5 text-sm rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Seyhan"
                                        />
                                    </div>
                                </div>

                                {/* Ödeme Tipi */}
                                <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-slate-700">Ödeme Tipi</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Kredi Kartı', 'Havale', 'Nakit'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setRetailPaymentType(type)}
                                                className={`py-2 rounded-xl font-bold text-xs transition-all active:scale-95 border-2 ${
                                                    retailPaymentType === type
                                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Action Buttons - Fixed at bottom */}
                        <div className="shrink-0 p-3 bg-white border-t border-slate-200 space-y-2">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRetailCustomerModal(false)}
                                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                                >
                                    İptal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDirectInvoice}
                                    disabled={invoiceLoading}
                                    className="flex-[2] py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                    {invoiceLoading ? (
                                        <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Gönderiliyor...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-base">receipt_long</span> Fatura Kes</>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleRetailCustomerSubmit}
                                className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98]"
                            >
                                Faturasız Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            {showBarcodeScanner && (
                <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center">
                    <button
                        onClick={stopBarcodeScanner}
                        className="absolute top-5 right-5 text-4xl text-white bg-transparent border-none cursor-pointer z-10"
                    >
                        &times;
                    </button>

                    {/* Scanner container for html5-qrcode */}
                    <div
                        id="barcode-scanner-container"
                        className="w-[90%] max-w-[400px] rounded-xl overflow-hidden"
                    ></div>

                    <p className="text-white text-lg mt-4">Barkodu kameraya gösterin...</p>

                    {scannerError && (
                        <div className="mt-4 px-6 py-3 bg-red-500 text-white rounded-lg text-center">
                            {scannerError}
                        </div>
                    )}

                    {/* Manual barcode input as fallback */}
                    <div className="mt-6 flex gap-2 w-[90%] max-w-[400px]">
                        <input
                            type="text"
                            placeholder="Barkodu manuel girin..."
                            className="flex-1 px-4 py-3 rounded-lg text-lg"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value) {
                                    addProductByBarcode(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const input = e.target.previousSibling;
                                if (input.value) {
                                    addProductByBarcode(input.value);
                                    input.value = '';
                                }
                            }}
                            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                        >
                            Ekle
                        </button>
                    </div>
                </div>
            )}

            {/* Price Check Modal */}
            {showPriceCheckModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                💰 Fiyat Sorgula
                            </h2>
                            <button
                                onClick={() => {
                                    setShowPriceCheckModal(false);
                                    setPriceCheckProduct(null);
                                    if (priceCheckScannerRef.current) {
                                        priceCheckScannerRef.current.stop().catch(() => { });
                                        priceCheckScannerRef.current = null;
                                    }
                                    setShowPriceCheckScanner(false);
                                }}
                                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-2xl hover:bg-white/30 transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            {/* Barcode Scanner Button */}
                            {!showPriceCheckScanner ? (
                                <button
                                    onClick={async () => {
                                        setShowPriceCheckScanner(true);
                                        setPriceCheckProduct(null);
                                        setTimeout(async () => {
                                            try {
                                                const scanner = new Html5Qrcode('price-check-scanner');
                                                priceCheckScannerRef.current = scanner;
                                                await scanner.start(
                                                    { facingMode: 'environment' },
                                                    { fps: 10, qrbox: { width: 250, height: 150 } },
                                                    (decodedText) => {
                                                        const found = products.find(p =>
                                                            p.barcode === decodedText ||
                                                            p.stock_code === decodedText ||
                                                            p.stock_code?.toLowerCase() === decodedText.toLowerCase()
                                                        );
                                                        if (found) {
                                                            setPriceCheckProduct(found);
                                                        } else {
                                                            setPriceCheckProduct({ notFound: true, searchTerm: decodedText });
                                                        }
                                                        scanner.stop().catch(() => { });
                                                        priceCheckScannerRef.current = null;
                                                        setShowPriceCheckScanner(false);
                                                    },
                                                    () => { }
                                                );
                                            } catch (err) {
                                                console.error('Kamera hatası:', err);
                                                setShowPriceCheckScanner(false);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] transition-all"
                                >
                                    📷 Barkod Okut
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div id="price-check-scanner" className="w-full rounded-2xl overflow-hidden"></div>
                                    <button
                                        onClick={() => {
                                            if (priceCheckScannerRef.current) {
                                                priceCheckScannerRef.current.stop().catch(() => { });
                                                priceCheckScannerRef.current = null;
                                            }
                                            setShowPriceCheckScanner(false);
                                        }}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                                    >
                                        İptal
                                    </button>
                                </div>
                            )}

                            {/* Manual Search */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={priceCheckSearch}
                                    onChange={(e) => setPriceCheckSearch(e.target.value)}
                                    placeholder="Stok Kodu veya Barkod girin..."
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-lg"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && priceCheckSearch.trim()) {
                                            const found = products.find(p =>
                                                p.barcode === priceCheckSearch.trim() ||
                                                p.stock_code === priceCheckSearch.trim() ||
                                                p.stock_code?.toLowerCase() === priceCheckSearch.trim().toLowerCase()
                                            );
                                            if (found) {
                                                setPriceCheckProduct(found);
                                            } else {
                                                setPriceCheckProduct({ notFound: true, searchTerm: priceCheckSearch.trim() });
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (priceCheckSearch.trim()) {
                                            const found = products.find(p =>
                                                p.barcode === priceCheckSearch.trim() ||
                                                p.stock_code === priceCheckSearch.trim() ||
                                                p.stock_code?.toLowerCase() === priceCheckSearch.trim().toLowerCase()
                                            );
                                            if (found) {
                                                setPriceCheckProduct(found);
                                            } else {
                                                setPriceCheckProduct({ notFound: true, searchTerm: priceCheckSearch.trim() });
                                            }
                                        }
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                >
                                    Ara
                                </button>
                            </div>

                            {/* Product Result */}
                            {priceCheckProduct && (
                                <div className="mt-4 animate-slide-up">
                                    {priceCheckProduct.notFound ? (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                                            <span className="text-4xl">❌</span>
                                            <p className="text-lg font-semibold text-red-600 mt-2">Ürün Bulunamadı</p>
                                            <p className="text-gray-500 text-sm mt-1">"{priceCheckProduct.searchTerm}"</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                                            {/* Product Image */}
                                            {priceCheckProduct.image_url && (
                                                <div className="flex justify-center">
                                                    <img src={priceCheckProduct.image_url} alt={priceCheckProduct.name} className="w-24 h-24 object-cover rounded-xl shadow-md" />
                                                </div>
                                            )}

                                            {/* Product Info */}
                                            <div className="space-y-2 text-center">
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">Ürün Adı</p>
                                                <p className="text-lg font-bold text-gray-800">{priceCheckProduct.name}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div className="bg-white rounded-xl p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500">Stok Kodu</p>
                                                    <p className="font-semibold text-gray-700">{priceCheckProduct.stock_code}</p>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500">Barkod</p>
                                                    <p className="font-semibold text-gray-700 font-mono text-sm">{priceCheckProduct.barcode || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Price - Large */}
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center shadow-lg shadow-emerald-500/30">
                                                <p className="text-emerald-100 text-sm mb-1">Satış Fiyatı</p>
                                                <p className="text-4xl font-black text-white">
                                                    {priceCheckProduct.price?.toFixed(2)} TL
                                                </p>
                                            </div>

                                            {/* New Search Button */}
                                            <button
                                                onClick={() => {
                                                    setPriceCheckProduct(null);
                                                    setPriceCheckSearch('');
                                                }}
                                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                            >
                                                🔄 Yeni Arama
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Waitlist Modal */}
            {showWaitlistModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-slate-800">Bekleme Listesi</h3>
                            <button
                                onClick={() => setShowWaitlistModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-3xl"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {heldSales.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-5xl mb-3">📋</div>
                                    <p className="text-gray-500">Bekleyen satış bulunmuyor.</p>
                                </div>
                            ) : (
                                heldSales.map((sale) => (
                                    <div
                                        key={sale.id}
                                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-800">{sale.customer_name || 'Toptan Satış'}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(sale.created_at).toLocaleString('tr-TR', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-blue-600">
                                                    {(sale.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)} TL
                                                </p>
                                                <p className="text-[10px] text-gray-400">{(sale.items || []).length} Ürün</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => restoreHeldSale(sale)}
                                                className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-blue-600 transition-colors"
                                            >
                                                Geri Yükle
                                            </button>
                                            <button
                                                onClick={() => deleteHeldSale(sale.id)}
                                                className="w-12 py-2.5 bg-white border border-red-200 text-red-500 rounded-lg font-bold hover:bg-red-50 flex items-center justify-center transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button
                                onClick={() => setShowWaitlistModal(false)}
                                className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showUndefinedStockModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-[1000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <span
                            onClick={() => {
                                setShowUndefinedStockModal(false);
                                setUndefinedStockName('');
                                setUndefinedStockPrice('');
                                setUndefinedStockQuantity(1);
                                setUndefinedStockStep(1);
                            }}
                            className="float-right text-3xl text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                            &times;
                        </span>

                        {/* Step 1: Product Name */}
                        {undefinedStockStep === 1 && (
                            <>
                                <h3 className="text-xl font-bold text-slate-800 mb-4">Ürün Adı Girin</h3>
                                <input
                                    type="text"
                                    value={undefinedStockName}
                                    onChange={(e) => setUndefinedStockName(e.target.value)}
                                    placeholder="Ürün Adı"
                                    className="w-full p-4 text-lg border-2 border-blue-500 rounded-lg focus:outline-none mb-4"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && undefinedStockName.trim()) {
                                            setUndefinedStockStep(2);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (!undefinedStockName.trim()) {
                                            alert('Lütfen ürün adı girin.');
                                            return;
                                        }
                                        setUndefinedStockStep(2);
                                    }}
                                    className="w-full py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                                >
                                    İleri →
                                </button>
                            </>
                        )}

                        {/* Step 2: Quantity */}
                        {undefinedStockStep === 2 && (
                            <>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Miktar Girin</h3>
                                <p className="text-gray-600 mb-4">{undefinedStockName}</p>
                                <input
                                    type="number"
                                    value={undefinedStockQuantity}
                                    onChange={(e) => setUndefinedStockQuantity(e.target.value)}
                                    placeholder="Miktar"
                                    className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg focus:outline-none mb-4"
                                    min="1"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            setUndefinedStockStep(3);
                                        }
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setUndefinedStockStep(1)}
                                        className="flex-1 py-4 bg-gray-300 text-gray-700 text-lg font-bold rounded-lg cursor-pointer hover:bg-gray-400 transition-colors"
                                    >
                                        ← Geri
                                    </button>
                                    <button
                                        onClick={() => setUndefinedStockStep(3)}
                                        className="flex-1 py-4 bg-blue-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                                    >
                                        İleri →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Step 3: Price */}
                        {undefinedStockStep === 3 && (
                            <>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Fiyat Girin (TL)</h3>
                                <p className="text-gray-600 mb-4">{undefinedStockName} - {undefinedStockQuantity} Adet</p>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={undefinedStockPrice}
                                    onChange={(e) => setUndefinedStockPrice(e.target.value)}
                                    placeholder="Fiyat"
                                    className="w-full p-4 text-2xl text-center border-2 border-blue-500 rounded-lg focus:outline-none mb-4"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && undefinedStockPrice) {
                                            const price = parseFloat(undefinedStockPrice) || 0;
                                            const quantity = parseFloat(undefinedStockQuantity) || 1;
                                            const undefinedProduct = {
                                                id: 'UNDEFINED-' + Date.now(),
                                                stock_code: 'TANIMSIZ-' + Date.now(),
                                                name: undefinedStockName,
                                                price: price,
                                                quantity: quantity,
                                                discount_rate: 0,
                                                final_price: price
                                            };
                                            setCart(prev => [...prev, undefinedProduct]);
                                            setSuccessMessage(`${undefinedStockName} eklendi!`);
                                            setTimeout(() => setSuccessMessage(''), 1500);
                                            setShowUndefinedStockModal(false);
                                            setUndefinedStockName('');
                                            setUndefinedStockPrice('');
                                            setUndefinedStockQuantity(1);
                                            setUndefinedStockStep(1);
                                        }
                                    }}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setUndefinedStockStep(2)}
                                        className="flex-1 py-4 bg-gray-300 text-gray-700 text-lg font-bold rounded-lg cursor-pointer hover:bg-gray-400 transition-colors"
                                    >
                                        ← Geri
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!undefinedStockPrice) {
                                                alert('Lütfen fiyat girin.');
                                                return;
                                            }
                                            const price = parseFloat(undefinedStockPrice) || 0;
                                            const quantity = parseFloat(undefinedStockQuantity) || 1;
                                            const undefinedProduct = {
                                                id: 'UNDEFINED-' + Date.now(),
                                                stock_code: 'TANIMSIZ-' + Date.now(),
                                                name: undefinedStockName,
                                                price: price,
                                                quantity: quantity,
                                                discount_rate: 0,
                                                final_price: price
                                            };
                                            setCart(prev => [...prev, undefinedProduct]);
                                            setSuccessMessage(`${undefinedStockName} eklendi!`);
                                            setTimeout(() => setSuccessMessage(''), 1500);
                                            setShowUndefinedStockModal(false);
                                            setUndefinedStockName('');
                                            setUndefinedStockPrice('');
                                            setUndefinedStockQuantity(1);
                                            setUndefinedStockStep(1);
                                        }}
                                        className="flex-1 py-4 bg-orange-500 text-white text-lg font-bold rounded-lg cursor-pointer hover:bg-orange-600 transition-colors"
                                    >
                                        Sepete Ekle
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Status Modal */}
            <StatusModal
                isOpen={statusModal.isOpen}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
                details={statusModal.details}
                actionButton={statusModal.actionButton}
                onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
            />

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
                @keyframes slide-down {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
                }
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
    );
}
