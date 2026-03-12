import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productsAPI, salesAPI, customersAPI, shortcutsAPI, heldSalesAPI, settingsAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';
import { useAuth } from '../context/AuthContext';
import defaultTemplate from '../data/default_receipt_template.json';
import template80mm from '../data/receipt_template_80mm.json';
import template58mm from '../data/receipt_template_58mm.json';
import DebtLimitAlert from '../components/modals/DebtLimitAlert';
import ProductFormModal from '../components/modals/ProductFormModal';
import CustomerFormModal from '../components/modals/CustomerFormModal';
import PaymentFormModal from '../components/modals/PaymentFormModal';
import ProductSelectionModal from '../components/modals/ProductSelectionModal';
import StatusModal from '../components/modals/StatusModal';
import ReturnModal from '../components/modals/ReturnModal';
import ShortcutGroupsModal from '../components/modals/ShortcutGroupsModal';
import KeyboardShortcutsModal from '../components/modals/KeyboardShortcutsModal';

// Mobile detection hook
function useMobileRedirect() {
    const navigate = useNavigate();

    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 768) {
                navigate('/mobile-pos', { replace: true });
            }
        };

        // Check on mount
        checkMobile();

        // Optional: check on resize
        // window.addEventListener('resize', checkMobile);
        // return () => window.removeEventListener('resize', checkMobile);
    }, [navigate]);
}

// Product Card Component to handle Image State separately
const ProductCard = memo(({ product, onAddToCart }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            onClick={() => onAddToCart(product)}
            className="h-full bg-white rounded-xl border border-slate-200 p-2 shadow-sm hover:shadow-lg hover:border-blue-600/30 hover:-translate-y-0.5 transition-all group flex flex-col cursor-pointer"
        >
            <div className="w-full h-24 rounded-lg bg-slate-50 overflow-hidden relative flex-shrink-0 border border-slate-100 mb-1">
                {/* Placeholder / Skeleton */}
                <div className={`absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-300 transition-opacity duration-300 ${imgError ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="material-symbols-outlined text-3xl">image</span>
                </div>

                {/* Actual Image */}
                {!imgError && (
                    <img
                        alt={product.name}
                        className="w-full h-full object-contain hover:scale-110 transition-all duration-500 opacity-0 data-[loaded=true]:opacity-100"
                        src={product.image_url || 'https://via.placeholder.com/150'}
                        onError={() => setImgError(true)}
                        onLoad={(e) => e.target.setAttribute('data-loaded', 'true')}
                        loading="lazy"
                    />
                )}
            </div>
            <div className="flex flex-col flex-1 px-1">
                {/* Fixed height for 2 lines of text to ensure alignment */}
                <h3 className="text-sm font-bold text-slate-700 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                </h3>
                <span className="text-base font-extrabold text-red-600 leading-none mt-0.5">{product.price?.toFixed(2)} ₺</span>
            </div>
        </div>
    );
});

export default function NewPOSPage() {
    const navigate = useNavigate();
    // Mobile redirect
    useMobileRedirect();

    const { user, logout } = useAuth();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(['Tümü']);
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [cart, setCart] = useState([]);
    const cartRef = useRef(cart); // Ref to hold latest cart
    const [selectedCartIndex, setSelectedCartIndex] = useState(null);
    const [customer, setCustomer] = useState('Toptan Satış');
    const [customers, setCustomers] = useState([]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');

    // Modals
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showWaitlistModal, setShowWaitlistModal] = useState(false);
    const [showShortcutGroupsModal, setShowShortcutGroupsModal] = useState(false);
    const [showKeyboardShortcutsModal, setShowKeyboardShortcutsModal] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(() => localStorage.getItem('pos_display_limit') || '100');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true); // Initial loading state

    const [heldSales, setHeldSales] = useState([]);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [shortcuts, setShortcuts] = useState([]);
    const searchInputRef = useRef(null);
    const [keyboardShortcuts, setKeyboardShortcuts] = useState({});

    const [companySettings, setCompanySettings] = useState({
        name: 'Firma Adı',
        address: '',
        phone: '',
        logo_url: null,
        logo_text: 'K'
    });
    const [debtLimits, setDebtLimits] = useState({});
    const [showDebtLimitAlert, setShowDebtLimitAlert] = useState(false);
    const [debtLimitAlertData, setDebtLimitAlertData] = useState(null);

    // New Action Modals
    const [showNewProductModal, setShowNewProductModal] = useState(false);
    const [newProductInitialValues, setNewProductInitialValues] = useState(null);

    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentTransactionType, setPaymentTransactionType] = useState('payment');

    // Multiple Matches Logic
    const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);
    const [productMatches, setProductMatches] = useState([]);

    // Status Modal (Modern Alert)
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'error', details: null });


    useEffect(() => {
        const loadCompanySettings = async () => {
            try {
                // Fetch Company Settings
                const nameRes = await settingsAPI.get('company_name');
                const addressRes = await settingsAPI.get('company_address');
                const phoneRes = await settingsAPI.get('company_phone');
                const logoRes = await settingsAPI.get('company_logo');

                setCompanySettings(prev => ({
                    ...prev,
                    name: nameRes.data || prev.name,
                    address: addressRes.data || prev.address,
                    phone: phoneRes.data || prev.phone,
                    logo_url: logoRes.data || prev.logo_url,
                    logo_text: (nameRes.data || prev.name).charAt(0).toUpperCase()
                }));

                // Fetch Debt Limits
                const limitsRes = await settingsAPI.get('customer_debt_limits');
                if (limitsRes.data) {
                    setDebtLimits(limitsRes.data);
                }

            } catch (error) {
                console.error("Error loading settings", error);
            }

            // Sync auto print setting
            try {
                const res = await settingsAPI.get('receipt_auto_print');
                if (res.data !== undefined) {
                    localStorage.setItem('receipt_auto_print', res.data);
                }
            } catch (e) { console.error("Error syncing auto print", e); }
        };
        loadCompanySettings();
    }, []);

    // Retail Customer Logic
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

    // Ask Quantity Logic
    const [showAskQuantityModal, setShowAskQuantityModal] = useState(false);
    const [askQuantityValue, setAskQuantityValue] = useState(1);
    const [productToAdd, setProductToAdd] = useState(null);
    const [modalValue, setModalValue] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Cart Settings (Simplified for new design - mostly unused but keeping for compatibility)
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });

    // Undefined Product Logic
    const [showUndefinedProductModal, setShowUndefinedProductModal] = useState(false);
    const [undefinedProductStep, setUndefinedProductStep] = useState(0); // 0: Name, 1: Qty, 2: Price
    const [undefinedProductData, setUndefinedProductData] = useState({ name: '', quantity: 1, price: '' });
    const undefinedNameRef = useRef(null);
    const undefinedQtyRef = useRef(null);
    const undefinedPriceRef = useRef(null);

    // Sync cartRef with cart state
    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    // Load Data
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([
                loadProducts(),
                loadCustomers(),
                loadHeldSales(),
                loadShortcuts(),
                loadSettings()
            ]);
            setTimeout(() => setLoading(false), 300); // 300ms buffer for smooth transition
        };
        init();

        // Load Shortcuts Logic (unchanged below)
        const defaultShortcuts = {
            'miktar_duzenle': 'F2',
            'iskonto_ekle': 'F3',
            'fiyat_duzenle': 'F4',
            'nakit_odeme': 'F8',
            'pos_odeme': 'F9',
            'musteri_sec': 'F10',
            'search_focus': 'F1',
            'tanimsiz_urun': 'Insert'
        };

        // Listen for shortcut updates
        const handleShortcutUpdate = () => {
            const saved = localStorage.getItem('pos_keyboard_shortcuts');
            if (saved) {
                try {
                    setKeyboardShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
                } catch (e) {
                    console.error("Shortcuts parse error", e);
                }
            } else {
                setKeyboardShortcuts(defaultShortcuts);
            }
        };

        window.addEventListener('shortcutsUpdated', handleShortcutUpdate);

        const saved = localStorage.getItem('pos_keyboard_shortcuts');
        if (saved) {
            try {
                setKeyboardShortcuts({ ...defaultShortcuts, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Shortcuts parse error", e);
                setKeyboardShortcuts(defaultShortcuts);
            }
        } else {
            setKeyboardShortcuts(defaultShortcuts);
        }

        return () => {
            window.removeEventListener('shortcutsUpdated', handleShortcutUpdate);
        };
    }, []);

    // Helper Functions
    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            const data = response.data || {};
            setProducts(data.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
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

    const loadHeldSales = async () => {
        try {
            const response = await heldSalesAPI.getAll();
            setHeldSales(response.data?.held_sales || []);
        } catch (error) {
            console.error('Bekleyen satışlar yüklenirken hata:', error);
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

    const loadSettings = async () => {
        try {
            const { data } = await settingsAPI.getAll();
            if (data && data.pos_settings_ask_quantity !== undefined) {
                // Update localStorage so addToCart can use it synchronously
                localStorage.setItem('pos_settings_ask_quantity', data.pos_settings_ask_quantity);
            }
        } catch (error) {
            console.error('Ayarlar yüklenirken hata:', error);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Handle +/- for quantity on selected item
            if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                if (e.key === '+' || e.key === 'Add') {
                    e.preventDefault();
                    updateCartItem(selectedCartIndex, 'quantity', cart[selectedCartIndex].quantity + 1);
                    return;
                }
                if (e.key === '-' || e.key === 'Subtract') {
                    e.preventDefault();
                    const newQty = cart[selectedCartIndex].quantity - 1;
                    if (newQty >= 1) {
                        updateCartItem(selectedCartIndex, 'quantity', newQty);
                    }
                    return;
                }
            }

            const action = Object.keys(keyboardShortcuts).find(key => keyboardShortcuts[key] === e.key);
            if (!action) return;
            if (e.key.startsWith('F')) e.preventDefault();

            switch (action) {
                case 'search_focus': searchInputRef.current?.focus(); break;
                case 'nakit_odeme': if (cart.length > 0) completeSale('Nakit'); break;
                case 'pos_odeme': if (cart.length > 0) completeSale('POS'); break;
                case 'miktar_duzenle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].quantity);
                        setShowQuantityModal(true);
                    }
                    break;
                case 'iskonto_ekle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].discount_rate || 0);
                        setShowDiscountModal(true);
                    }
                    break;
                case 'fiyat_duzenle':
                    if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                        setModalValue(cart[selectedCartIndex].price);
                        setShowPriceModal(true);
                    }
                    break;
                case 'musteri_sec': setShowCustomerModal(true); break;
                case 'tanimsiz_urun':
                    setUndefinedProductData({ name: '', quantity: 1, price: '' });
                    setUndefinedProductStep(0);
                    setShowUndefinedProductModal(true);
                    setTimeout(() => undefinedNameRef.current?.focus(), 100);
                    break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [keyboardShortcuts, cart, selectedCartIndex]);

    // Auto-scroll to selected item
    const cartItemsRef = useRef([]);
    useEffect(() => {
        if (selectedCartIndex !== null && cartItemsRef.current[selectedCartIndex]) {
            cartItemsRef.current[selectedCartIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedCartIndex]);

    // Filtering (Memoized)
    const filteredProducts = useMemo(() => {
        const currentGroup = selectedCategory !== 'Tümü'
            ? shortcuts.find(s => s.name === selectedCategory)
            : null;
        const groupItems = currentGroup?.items || [];

        let result = products.filter(p => {
            let matchesCategory = true;
            if (selectedCategory !== 'Tümü') {
                matchesCategory = groupItems.includes(p.stock_code);
            }
            const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.barcode?.includes(searchTerm) ||
                p.stock_code?.toLowerCase().includes(searchTerm.toLowerCase());
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
    }, [products, selectedCategory, searchTerm, shortcuts]);

    const displayedProducts = useMemo(() => {
        if (displayLimit === 'Hepsi') return filteredProducts;
        const limit = parseInt(displayLimit);
        const startIndex = (currentPage - 1) * limit;
        return filteredProducts.slice(startIndex, startIndex + limit);
    }, [filteredProducts, displayLimit, currentPage]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm]);

    const handleLimitChange = (e) => {
        const val = e.target.value;
        setDisplayLimit(val);
        localStorage.setItem('pos_display_limit', val);
    };

    // Handlers
    const addToCart = useCallback((product) => {
        const askQty = localStorage.getItem('pos_settings_ask_quantity') === 'true';
        if (askQty) {
            setProductToAdd(product);
            setAskQuantityValue('1');
            setShowAskQuantityModal(true);
            return;
        }

        const currentCart = cartRef.current;
        const existingIndex = currentCart.findIndex(item => item.stock_code === product.stock_code);

        if (existingIndex >= 0) {
            const newCart = [...currentCart];
            newCart[existingIndex] = {
                ...newCart[existingIndex],
                quantity: newCart[existingIndex].quantity + 1
            };
            setCart(newCart);
            setSelectedCartIndex(existingIndex);
        } else {
            setCart([...currentCart, { ...product, quantity: 1, discount_rate: 0 }]);
            setSelectedCartIndex(currentCart.length);
        }
    }, []); // Empty dependency array = Stable Reference!

    const confirmAddQuantity = (e) => {
        e.preventDefault();
        if (!productToAdd) return;
        const quantity = parseFloat(askQuantityValue) || 1;
        const existingIndex = cart.findIndex(item => item.stock_code === productToAdd.stock_code);
        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += quantity;
            setCart(newCart);
            setSelectedCartIndex(existingIndex);
        } else {
            setCart([...cart, { ...productToAdd, quantity: quantity, discount_rate: 0 }]);
            setSelectedCartIndex(cart.length);
        }
        setShowAskQuantityModal(false);
        setProductToAdd(null);
        setBarcodeInput('');
    };

    const handleBarcodeInput = (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            const searchTerm = barcodeInput.trim().toLocaleLowerCase('tr-TR');
            const matches = products.filter(p => {
                const barcode = p.barcode ? String(p.barcode).trim() : '';
                const stockCode = p.stock_code ? String(p.stock_code).trim().toLocaleLowerCase('tr-TR') : '';

                // Check for exact barcode match OR stock code match
                // We use the raw input for barcode (case sensitive usually, but here likely numeric)
                // But for stock code we definitely want case insensitivity
                return barcode === barcodeInput.trim() || stockCode === searchTerm;
            });

            if (matches.length === 1) {
                addToCart(matches[0]);
                setBarcodeInput('');
            } else if (matches.length > 1) {
                setProductMatches(matches);
                setShowProductSelectionModal(true);
                // Don't clear input yet, maybe user wants to see what they typed? 
                // Or clear it? Let's clear it to be clean.
                setBarcodeInput('');
            } else {
                // Determine error details
                let title = 'Ürün Bulunamadı';
                let msg = `"${barcodeInput}" kriterine uygun ürün bulunamadı.`;
                let details = `Aranan: "${searchTerm}"`;
                let type = 'error';

                if (products.length === 0) {
                    title = 'Veri Yüklenmedi';
                    msg = 'Sistemde hiç ürün yüklü görünmüyor veya ürünler henüz yüklenmedi.';
                    details = 'Lütfen sayfayı yenileyin veya ürünlerinizin tanımlı olduğundan emin olun.\n(Toplam Ürün: 0)';
                    type = 'warning';

                    // Auto-retry loading if empty
                    console.log('Products empty, auto-retrying load...');
                    loadProducts();
                }

                // Status Modal Button Action
                const actionButton = {
                    label: 'Yeni Ürün Olarak Ekle',
                    className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                    onClick: () => {
                        // User requested: Always fill 'Barcode' field with the input, regardless of content (text/number).
                        // Stock code will be auto-generated by the modal.
                        setNewProductInitialValues({
                            barcode: barcodeInput.trim(),
                            stock_code: ''
                        });

                        setStatusModal(prev => ({ ...prev, isOpen: false }));
                        setShowNewProductModal(true);
                    }
                };

                setStatusModal({
                    isOpen: true,
                    title,
                    message: msg,
                    type,
                    details,
                    actionButton
                });
                setBarcodeInput('');
            }
        }
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
        setCart(newCart);
        setShowQuantityModal(false);
        setShowDiscountModal(false);
        setShowPriceModal(false);
    };

    const removeFromCart = (index) => {
        const newCart = cart.filter((_, i) => i !== index);
        setCart(newCart);
        if (selectedCartIndex === index) setSelectedCartIndex(null);
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            const price = item.price * item.quantity;
            const discount = price * (item.discount_rate || 0) / 100;
            return sum + (price - discount);
        }, 0);
    };

    const handleRetailCustomerSubmit = (e) => {
        e.preventDefault();
        if (!retailCustomerForm.name.trim()) return alert('İsim Soyisim zorunludur!');
        setCustomer(`Perakende-${retailCustomerForm.name.trim()}`);
        setShowRetailCustomerModal(false);
        setShowCustomerModal(false);
    };

    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [taxPayerLoading, setTaxPayerLoading] = useState(false);
    const [taxPayerResult, setTaxPayerResult] = useState(null); // null | { isEFatura, title }
    const [taxOffices, setTaxOffices] = useState([]);
    const [taxOfficeSearch, setTaxOfficeSearch] = useState('');
    const [showTaxOfficeDropdown, setShowTaxOfficeDropdown] = useState(false);

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

    const handleTaxPayerQuery = async () => {
        const taxNo = retailCustomerForm.tax_number.trim();
        if (taxNo.length < 10) return;
        setTaxPayerLoading(true);
        setTaxPayerResult(null);
        const result = await birFaturaAPI.queryTaxPayer(taxNo);
        setTaxPayerLoading(false);
        if (result.success && result.data) {
            const title = result.data.title || result.data.name || '';
            setRetailCustomerForm(prev => ({
                ...prev,
                name: title || prev.name,
            }));
            setTaxPayerResult({ isEFatura: true, title });
        } else if (result.success && !result.data) {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        } else {
            setTaxPayerResult({ isEFatura: false, message: result.message });
        }
    };

    // Ödeme tipi → BirFatura açıklama eşlemesi
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
        const saleCode = 'SLS-' + Date.now();
        const birFaturaPaymentText = paymentTypeMap[retailPaymentType] || '';
        const result = await birFaturaAPI.sendBasicInvoice({
            retailForm: retailCustomerForm,
            cart,
            paymentMethod: birFaturaPaymentText,
            saleCode
        });
        setInvoiceLoading(false);
        if (result.success) {
            // Fatura başarılı → satışı tamamla
            const perakendeCustomerName = `Perakende-${retailCustomerForm.name.trim()}`;
            setCustomer(perakendeCustomerName);
            setShowRetailCustomerModal(false);
            setShowCustomerModal(false);
            let pdfUrl = result.data?.Result?.PdfUrl || result.data?.result?.pdfUrl || null;
            const invoiceUuid = result.ettn || result.data?.Result?.ETTN || result.data?.result?.ETTN || result.data?.Result?.UUID || result.data?.result?.UUID || null;
            console.log('[NewPOS] Fatura response:', JSON.stringify(result.data, null, 2));

            // PDF linki doğrudan gelmezse UUID ile sorgula
            if (!pdfUrl && invoiceUuid) {
                try {
                    // API'nin faturayı işlemesi için kısa bir bekleme
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const pdfResult = await birFaturaAPI.getPdfLink(invoiceUuid);
                    if (pdfResult.success && pdfResult.pdfUrl) {
                        pdfUrl = pdfResult.pdfUrl;
                    }
                } catch (pdfErr) {
                    console.warn('[NewPOS] PDF link alınamadı:', pdfErr);
                }
            }

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
                        quantity: item.quantity, price: item.price, discount_rate: item.discount_rate || 0,
                        amount: item.quantity
                    })),
                    total: calculateTotal()
                });

                if (localStorage.getItem('receipt_auto_print') === 'true') {
                    printReceipt({
                        customer: perakendeCustomerName, paymentMethod: retailPaymentType, items: cart,
                        total: calculateTotal(), customerData: selectedCust
                    });
                }

                setCart([]);
                setCustomer('Toptan Satış');
                setRetailCustomerForm(defaultRetailForm);
                setRetailPaymentType('Kredi Kartı');
                loadProducts();
            } catch (error) {
                console.error('[NewPOS] Satış kaydetme hatası:', error);
            }

            setStatusModal({
                isOpen: true,
                title: 'Fatura Gönderildi ✓',
                message: 'E-Fatura/E-Arşiv fatura başarıyla gönderildi ve satış tamamlandı.',
                type: 'success',
                details: null,
                actionButton: pdfUrl ? {
                    label: '📄 Kesilen Faturayı Görüntüle',
                    onClick: () => window.open(pdfUrl, '_blank')
                } : null
            });
            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
        } else {
            setStatusModal({ isOpen: true, title: 'Fatura Hatası', message: result.message, type: 'error', details: null });
        }
    };

    const handleRetailCustomerChange = (e) => {
        const { name, value } = e.target;
        setRetailCustomerForm(prev => ({ ...prev, [name]: value }));
        if (name === 'tax_number') {
            setTaxPayerResult(null);
        }
    };

    const completeSale = async (paymentMethod) => {
        if (cart.length === 0) return alert('Sepet boş!');

        // Veresiye sadece kayıtlı müşterilere verilebilir
        if (paymentMethod === 'Açık Hesap' || paymentMethod === 'Veresiye') {
            const isRegisteredCustomer = customers.find(c => c.name === customer);
            if (!isRegisteredCustomer) {
                setStatusModal({ isOpen: true, title: 'Veresiye Satış Yapılamaz', message: 'Veresiye satış sadece sistemde kayıtlı müşteri veya firmalara yapılabilir. Lütfen önce bir müşteri seçin.', type: 'error', details: null });
                return;
            }
        }

        // Debt Limit Check
        if (paymentMethod === 'Açık Hesap' || paymentMethod === 'Veresiye') {
            const selectedCustomer = customers.find(c => c.name === customer);
            if (selectedCustomer) {
                const limit = parseFloat(debtLimits[selectedCustomer.id]);
                if (limit > 0) {
                    const currentBalance = parseFloat(selectedCustomer.balance) || 0;
                    const cartTotal = calculateTotal();
                    const projectedBalance = currentBalance + cartTotal;

                    if (projectedBalance > limit) {
                        setDebtLimitAlertData({
                            currentBalance,
                            transactionAmount: cartTotal,
                            newBalance: projectedBalance,
                            limit
                        });
                        setShowDebtLimitAlert(true);
                        return;
                    }
                }
            }
        }

        try {
            const saleCode = 'SLS-' + Date.now();
            const selectedCustomer = customers.find(c => c.name === customer);
            const displayCustomerName = (customer || 'Toptan Satış').trim();

            await salesAPI.complete({
                sale_code: saleCode,
                customer: selectedCustomer || null,
                customer_name: !selectedCustomer ? displayCustomerName : undefined,
                tax_number: retailCustomerForm.tax_number,
                address: retailCustomerForm.address,
                phone: retailCustomerForm.phone,
                payment_method: paymentMethod,
                items: cart.map(item => ({
                    id: item.id, stock_code: item.stock_code, barcode: item.barcode, name: item.name,
                    quantity: item.quantity, price: item.price, discount_rate: item.discount_rate || 0,
                    amount: item.quantity
                })),
                total: calculateTotal()
            });

            if (localStorage.getItem('integration_send_sales_to_birfatura') === 'true') {
                birFaturaAPI.createOrder({
                    sale_code: saleCode
                }).then(async (result) => {
                    if (result.success && result.data?.Result?.UUID) {
                        try {
                            const invoiceUuid = result.data.Result.UUID;
                            console.log(`[NewPOS] Fatura oluşturuldu. UUID: ${invoiceUuid}`);
                            await salesAPI.update(saleCode, {
                                birfatura_uuid: invoiceUuid
                            });
                        } catch (err) {
                            console.error("[NewPOS] UUID veritabanına kaydedilemedi:", err);
                        }
                    } else if (!result.success) {
                        alert("BirFatura Hatası: " + result.message);
                    }
                });
            }

            if (localStorage.getItem('receipt_auto_print') === 'true') {
                printReceipt({
                    customer: customer, paymentMethod: paymentMethod, items: cart,
                    total: calculateTotal(), customerData: selectedCustomer
                });
            }

            setSuccessMessage('Satış İşlemi Başarılı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            setRetailCustomerForm(defaultRetailForm);
            loadProducts();
        } catch (error) {
            alert('Satış hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const holdSale = async () => {
        if (cart.length === 0) return alert('Sepet boş!');
        try {
            await heldSalesAPI.add({ customer, items: cart });
            setSuccessMessage('Satış Beklemeye Alındı');
            setTimeout(() => setSuccessMessage(''), 2000);
            setCart([]);
            setCustomer('Toptan Satış');
            loadHeldSales();
        } catch (error) {
            alert('Beklemeye alma hatası: ' + error.message);
        }
    };

    const restoreHeldSale = async (sale) => {
        setCart(sale.items || []);
        setCustomer(sale.customer_name || 'Toptan Satış');
        try { await heldSalesAPI.delete(sale.id); loadHeldSales(); }
        catch (error) { console.error(error); }
        setShowWaitlistModal(false);
    };

    const deleteHeldSale = async (saleId) => {
        try { await heldSalesAPI.delete(saleId); loadHeldSales(); }
        catch (error) { alert('Silme hatası: ' + error.message); }
    };

    // Paper size dimensions in pixels (for print)
    const PAPER_SIZES = {
        'A5 (148x210mm)': { width: 420, height: 595 },
        'A4 (210x297mm)': { width: 595, height: 842 },
        'Termal 80mm': { width: 280, height: 'auto' },
        'Termal 58mm': { width: 200, height: 'auto' },
    };

    // Print Receipt Function - Uses saved template or default template
    const printReceipt = (saleData) => {
        // Get selected paper size
        const paperSize = localStorage.getItem('receipt_paper_size') || 'Termal 80mm';

        // Custom A5 HTML Design varsayılan olarak aktif
        // Sadece açıkça başka bir template seçildiyse devre dışı kalır
        const templateType = localStorage.getItem('receipt_template_type');
        let useCustomA5 = templateType === 'custom_html_a5' || !templateType;

        if (useCustomA5) {
            printCustomA5Receipt(saleData, paperSize);
            return;
        }
        // Use dynamic template for ALL paper sizes
        const savedKey = `receipt_design_template_${paperSize}`;
        const savedTemplate = localStorage.getItem(savedKey);

        let template;
        try {
            template = savedTemplate ? JSON.parse(savedTemplate) : null;
        } catch {
            template = null;
        }

        // If no saved template, use the default template for the paper size
        if (!template) {
            switch (paperSize) {
                case 'Termal 80mm':
                    template = { ...template80mm };
                    break;
                case 'Termal 58mm':
                    template = { ...template58mm };
                    break;
                case 'A4 (210x297mm)':
                case 'A5 (148x210mm)':
                    // Use clean HTML table-based receipt for A4/A5
                    printA5Receipt(saleData, paperSize);
                    return;
                default:
                    template = { ...defaultTemplate };
                    break;
            }
        }

        const dimensions = PAPER_SIZES[paperSize] || PAPER_SIZES['Termal 80mm'];
        const now = new Date();

        // Replace variables in text
        const replaceVariables = (text, item = null) => {
            if (!text) return '';
            let result = text;
            result = result.replace('{{TARIH}}', now.toLocaleDateString('tr-TR'));
            result = result.replace('{{SAAT}}', now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
            result = result.replace('{{FIS_NO}}', now.getTime().toString());
            result = result.replace('{{MUSTERI_ADI}}', saleData.customer || 'Müşteri');
            result = result.replace('{{ODEME_TIPI}}', saleData.paymentMethod || 'Nakit');
            result = result.replace('{{GENEL_TOPLAM}}', saleData.total.toFixed(2));

            // Balance variables
            const previousBalance = saleData.customerData?.balance || 0;
            const newBalance = previousBalance + saleData.total;

            result = result.replace('{{ESKI_BAKIYE}}', previousBalance.toFixed(2));
            result = result.replace('{{YENI_BAKIYE}}', newBalance.toFixed(2));

            if (item) {
                result = result.replace('{{URUN_ADI}}', item.name || '');
                result = result.replace('{{MIKTAR}}', item.quantity?.toString() || '1');
                result = result.replace('{{FIYAT}}', item.price?.toFixed(2) || '0.00');
                result = result.replace('{{ISKONTO}}', (item.discount_rate || 0).toString());
                const lineTotal = (item.price * item.quantity * (1 - (item.discount_rate || 0) / 100));
                result = result.replace('{{SATIR_TOPLAM}}', lineTotal.toFixed(2));
            }
            return result;
        };

        // Separate product rows from static items
        // Show balance logic: Explicit setting enabled AND (Customer is selected AND not 'Toptan Satış' AND not Retail/Perakende)
        const showBalanceSetting = localStorage.getItem('receipt_show_balance') === 'true';
        const isRegisteredCustomer = saleData.customer &&
            saleData.customer !== 'Toptan Satış' &&
            !saleData.customer.startsWith('Perakende-');
        const shouldShowBalance = showBalanceSetting && isRegisteredCustomer;

        // Separate product rows from static items and filter footer items
        const staticItems = template.items.filter(i => !i.is_product_row && !i.is_dynamic_footer);
        const productRowTemplates = template.items.filter(i => i.is_product_row);

        // Filter out balance items if shouldShowBalance is false
        const footerItems = template.items.filter(i => {
            if (!i.is_dynamic_footer) return false;

            if (!shouldShowBalance) {
                // Check if item is related to balance
                const isBalanceItem = (i.id && (i.id.includes('bakiye') || i.id === 'eski_bakiye' || i.id === 'yeni_bakiye')) ||
                    (i.text && (i.text.includes('Bakiye') || i.text.includes('{{ESKI_BAKIYE}}') || i.text.includes('{{YENI_BAKIYE}}')));
                if (isBalanceItem) return false;
            }
            return true;
        });

        // Build HTML for static items
        let staticHtml = '';
        staticItems.forEach(item => {
            const style = `
                position: absolute;
                left: ${item.x}px;
                top: ${item.y}px;
                width: ${item.text_width || item.width || 100}px;
                height: ${item.text_height || item.height || 20}px;
                font-family: 'Tahoma', sans-serif;
                font-size: ${item.font_size || 10}px;
                font-weight: ${item.font_bold ? 'bold' : 'normal'};
                color: ${item.color || '#000'};
                text-align: ${item.text_align || 'left'};
                background-color: ${item.type === 'shape' ? (item.fill_color || 'transparent') : 'transparent'};
                display: flex;
                align-items: center;
                justify-content: ${item.text_align === 'center' ? 'center' : item.text_align === 'right' ? 'flex-end' : 'flex-start'};
                overflow: hidden;
                white-space: nowrap;
            `;
            if (item.type === 'text') {
                staticHtml += `<div style="${style}">${replaceVariables(item.text)}</div>`;
            } else if (item.type === 'shape') {
                staticHtml += `<div style="${style}"></div>`;
            } else if (item.type === 'image') {
                staticHtml += `<div style="${style}"><img src="${item.src}" style="width: 100%; height: 100%; object-fit: contain;"></div>`;
            }
        });

        // Build HTML for product rows
        let productRowsHtml = '';
        let currentY = productRowTemplates.length > 0 ? productRowTemplates[0].y : 120;
        const rowHeight = 16;

        saleData.items.forEach((product, index) => {
            productRowTemplates.forEach(templateItem => {
                const yOffset = index * rowHeight;
                const style = `
                    position: absolute;
                    left: ${templateItem.x}px;
                    top: ${templateItem.y + yOffset}px;
                    width: ${templateItem.text_width || 100}px;
                    height: ${templateItem.text_height || 14}px;
                    font-family: 'Tahoma', sans-serif;
                    font-size: ${templateItem.font_size || 9}px;
                    font-weight: ${templateItem.font_bold ? 'bold' : 'normal'};
                    color: ${templateItem.color || '#000'};
                    text-align: ${templateItem.text_align || 'left'};
                    display: flex;
                    align-items: center;
                    justify-content: ${templateItem.text_align === 'center' ? 'center' : templateItem.text_align === 'right' ? 'flex-end' : 'flex-start'};
                    overflow: hidden;
                    white-space: nowrap;
                `;
                productRowsHtml += `<div style="${style}">${replaceVariables(templateItem.text, product)}</div>`;
            });
            currentY += rowHeight;
        });

        // Build HTML for footer items (positioned after products)
        let footerHtml = '';
        const footerOffset = (saleData.items.length - 1) * rowHeight;
        footerItems.forEach(item => {
            const style = `
                position: absolute;
                left: ${item.x}px;
                top: ${item.y + footerOffset}px;
                width: ${item.text_width || item.width || 100}px;
                height: ${item.text_height || item.height || 20}px;
                font-family: 'Tahoma', sans-serif;
                font-size: ${item.font_size || 10}px;
                font-weight: ${item.font_bold ? 'bold' : 'normal'};
                color: ${item.color || '#000'};
                text-align: ${item.text_align || 'left'};
                background-color: ${item.type === 'shape' ? (item.fill_color || 'transparent') : 'transparent'};
                display: flex;
                align-items: center;
                justify-content: ${item.text_align === 'center' ? 'center' : item.text_align === 'right' ? 'flex-end' : 'flex-start'};
                overflow: hidden;
            `;
            if (item.type === 'text') {
                footerHtml += `<div style="${style}">${replaceVariables(item.text)}</div>`;
            } else if (item.type === 'shape') {
                footerHtml += `<div style="${style}"></div>`;
            } else if (item.type === 'image') {
                footerHtml += `<div style="${style}"><img src="${item.src}" style="width: 100%; height: 100%; object-fit: contain;"></div>`;
            }
        });

        const totalHeight = currentY + 100; // Extra space for footer

        const receiptContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Satış Fişi</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        width: ${dimensions.width}px; 
                        margin: 0 auto;
                        transform-origin: top left;
                    }
                    .receipt { position: relative; width: ${dimensions.width}px; min-height: ${totalHeight}px; }
                    @media print { 
                        body { 
                            margin: 0; 
                            ${(paperSize.includes('A5') || paperSize.includes('A4')) ? 'transform: scale(1.35);' : ''}
                        } 
                        @page { 
                            margin: 0; 
                            size: ${(paperSize.includes('A5') || paperSize.includes('A4')) ? 'auto' : `${dimensions.width}px auto`}; 
                        }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    ${staticHtml}
                    ${productRowsHtml}
                    ${footerHtml}
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', `width=${dimensions.width + 50},height=600`);
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 100);
        }
    };

    // Custom A5 HTML Receipt
    const printCustomA5Receipt = (saleData) => {
        // Use companySettings from state (fetched from DB)
        const companyInfo = companySettings;

        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR');
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        // Use saleData items directly as they are usually properly formatted in this component
        // But for safety, map them to ensure quantities are numbers
        const totalQuantity = saleData.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        // Format items HTML
        // Note: Truncating product name to single line with CSS (truncate class)
        const itemsHtml = saleData.items.map(item => `
            <tr>
                <td class="font-medium text-black">
                     <div class="flex items-center gap-2 min-w-0">
                        ${item.image_url
                ? `<div class="w-8 h-8 bg-white border border-black rounded flex items-center justify-center overflow-hidden"><img src="${item.image_url}" class="w-full h-full object-contain" /></div>`
                : `<div class="w-8 h-8 bg-white border border-black rounded flex items-center justify-center text-black">
                                <span class="material-symbols-outlined text-[16px]">image</span>
                           </div>`
            }
                        <span class="truncate block min-w-0" style="max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name.substring(0, 36)}</span>
                    </div>
                </td>
                <td class="text-center text-black">${item.quantity} ${item.unit || 'Ad.'}</td>
                <td class="text-right text-black">${item.price?.toFixed(2)} TL</td>
                <td class="text-right font-bold text-black">${(item.price * item.quantity).toFixed(2)} TL</td>
            </tr>
        `).join('');

        // Check if we should show customer balance
        const showBalanceSetting = localStorage.getItem('receipt_show_customer_balance') === 'true';
        const hasCustomer = saleData.customer_id || (saleData.customer && saleData.customer !== 'Misafir Müşteri');
        const showBalance = showBalanceSetting && hasCustomer;

        const balanceRows = showBalance ? `
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Eski Bakiye</span>
                        <span class="text-xs font-semibold text-slate-700">${previousBalance.toFixed(2)} TL</span>
                    </div>
        ` : '';

        const newBalanceRow = showBalance ? `
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Yeni Bakiye</span>
                        <span class="text-xs font-bold text-slate-900 underline underline-offset-4">${newBalance.toFixed(2)} TL</span>
                    </div>
        ` : '';

        const receiptContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>Satis Fisi</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
    <style type="text/tailwindcss">
        :root {
            --primary-color: #f97316;
            --print-width: 148mm;
            --print-height: 210mm;
        }
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .no-print {
                display: none !important;
            }
             @page {
                size: A5;
                margin: 0;
            }
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f1f5f9;
        }
        .a5-container {
            width: 148mm;
            min-height: 210mm;
            background-color: white;
            position: relative;
            overflow: hidden;
            padding: 5mm 5mm;
            display: flex;
            flex-direction: column;
            margin: 0 auto;
        }
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 180px;
            color: rgba(249, 115, 22, 0.03);
            pointer-events: none;
            user-select: none;
            z-index: 0;
            display: ${companyInfo.showWatermark ? 'block' : 'none'};
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
        }
        .receipt-table th {
            text-transform: uppercase;
            font-size: 0.65rem;
            letter-spacing: 0.05em;
            color: #000000;
            border: 1px solid #000000;
            padding: 4px 4px;
        }
        .receipt-table td {
            padding: 4px 4px;
            border-bottom: 1px solid #000000;
            border-top: 1px solid #000000;
        }
        .receipt-table td:first-child {
            border-left: 1px solid #000000;
        }
        .receipt-table td:last-child {
            border-right: 1px solid #000000;
        }
    </style>
</head>
<body class="p-4">
    <div class="a5-container relative flex flex-col shadow-lg">
        <div class="watermark">
            <span class="material-symbols-outlined text-[300px]">construction</span>
        </div>
        <header class="relative z-10 flex justify-between items-start mb-2 px-2 pt-0">
            <!-- Left: Date/Time -->
            <div class="w-[15%] text-left">
                <div class="flex flex-col items-center w-fit">
                    <div class="text-lg font-bold text-black tracking-tighter leading-none">${dateStr}</div>
                    <div class="text-lg font-bold text-black tracking-tighter leading-none">${timeStr}</div>
                </div>
            </div>

            <!-- Center: Logo & Company Info -->
            <div class="w-[70%] flex flex-col items-center text-center">
                ${companyInfo.logo_url
                ? `<div class="mb-1 h-9 flex items-center justify-center overflow-hidden"><img src="${companyInfo.logo_url}" class="h-full object-contain" /></div>`
                : `<div class="mb-1 bg-[var(--primary-color)] text-white p-1 rounded-lg font-extrabold text-base flex items-center justify-center w-9 h-9 shadow-sm">${companyInfo.logo_text}</div>`
            }
                <h1 class="font-black text-base tracking-tight leading-none text-black uppercase mb-0">${companyInfo.name}</h1>
                <p class="text-xs text-black font-bold uppercase tracking-normal leading-tight whitespace-nowrap mt-1">
                    ${companyInfo.address}<br/>
                    İletişim: ${companyInfo.phone}
                </p>
            </div>

            <!-- Right: Customer Info -->
            <div class="w-[15%] text-right flex flex-col items-end">
                ${!saleData.customer || saleData.customer === 'Misafir' || saleData.customer === 'Misafir Müşteri' || saleData.customer === 'Toptan Satış' ? '' : `
                <div class="border-2 border-black p-2 font-bold text-black text-sm uppercase whitespace-nowrap overflow-hidden">
                    ${saleData.customer.slice(0, 12)}
                </div>
                `}
            </div>
        </header>

        <main class="relative z-10 mb-1">
            <table class="w-full receipt-table text-left">
                <thead>
                    <tr>
                        <th class="w-1/2 text-center">Ürün Adı</th>
                        <th class="text-center">Miktar</th>
                        <th class="text-right">Birim Fiyat</th>
                        <th class="text-right">Toplam</th>
                    </tr>
                </thead>
                <tbody class="text-xs">
                    ${itemsHtml}
                </tbody>
            </table>
        </main>

        <footer class="relative z-10 pt-2 border-t border-slate-100">
            <div class="flex justify-end items-end">
                <div class="bg-slate-50 rounded-xl p-2 border border-slate-100 shadow-sm">
                    <div class="flex items-center gap-4">
                        <span class="text-xs text-black font-bold uppercase tracking-wider">GENEL TOPLAM</span>
                        <span class="text-2xl font-black text-black">${saleData.total.toFixed(2)} TL</span>
                    </div>
                </div>
            </div>
        </footer>
    </div>
    <script>
        // Auto print when loaded
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 1000); // Give time for Tailwind/Fonts to load
        }
    </script>
</body>
</html>
        `;

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
        }
    };

    // A5/A4 Clean HTML Table-based Receipt - Fixed width approach
    const printA5Receipt = (saleData, paperSize) => {
        const isA4 = paperSize === 'A4 (210x297mm)';
        // Use exact pixel dimensions for reliable printing
        // A5: 148mm x 210mm at 96dpi = ~559px x 794px
        // A4: 210mm x 297mm at 96dpi = ~794px x 1123px
        const contentWidth = isA4 ? 754 : 519; // Page width minus margins (20mm = ~76px each side for A4, 20mm = ~40px for A5)
        const companyName = localStorage.getItem('receipt_company_name') || 'FIRMA ADI';
        const companyAddress = localStorage.getItem('receipt_company_address') || 'Adres Bilgisi';
        const companyPhone = localStorage.getItem('receipt_company_phone') || 'Tel: 0XXX XXX XX XX';

        const receiptContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Satış Fişi</title>
    <style>
        @page {
            size: ${isA4 ? 'A4' : 'A5'};
            margin: 10mm;
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        html, body { 
            width: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif;
            font-size: ${isA4 ? '11px' : '10px'};
            color: #333;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .receipt-container {
            width: 100%;
            padding: 0;
        }
        .receipt-header { 
            text-align: center; 
            border-bottom: 1px solid #333; 
            padding-bottom: 8px; 
            margin-bottom: 8px; 
        }
        .receipt-header h1 { 
            font-size: ${isA4 ? '18px' : '14px'}; 
            margin-bottom: 2px; 
            color: #000;
            font-weight: bold;
        }
        .receipt-header .sub-info { 
            font-size: ${isA4 ? '10px' : '8px'}; 
            color: #0066cc; 
            line-height: 1.4;
        }
        .info-line {
            display: table;
            width: 100%;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
            font-size: ${isA4 ? '10px' : '9px'};
        }
        .info-line .left { 
            display: table-cell;
            text-align: left;
            width: 50%;
        }
        .info-line .right { 
            display: table-cell;
            text-align: right;
            width: 50%;
            font-weight: bold;
        }
        table.items { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 12px;
        }
        table.items th { 
            background: transparent; 
            color: #333; 
            padding: 4px 2px; 
            font-size: ${isA4 ? '9px' : '8px'};
            font-weight: bold;
            border-bottom: 1px solid #333;
        }
        table.items th.col-name { width: 50%; text-align: left; }
        table.items th.col-qty { width: 12%; text-align: center; }
        table.items th.col-price { width: 18%; text-align: center; }
        table.items th.col-total { width: 20%; text-align: center; }
        table.items td { 
            padding: 3px 2px; 
            font-size: ${isA4 ? '9px' : '8px'};
            vertical-align: top;
        }
        table.items td.col-name { text-align: left; }
        table.items td.col-qty { text-align: center; }
        table.items td.col-price { text-align: center; }
        table.items td.col-total { text-align: center; }
        .total-section { 
            margin-top: 15px;
            text-align: center;
        }
        .total-amount {
            font-size: ${isA4 ? '14px' : '12px'}; 
            font-weight: bold;
        }
        .footer-msg { 
            text-align: center; 
            margin-top: 20px;
            color: #0066cc; 
            font-size: ${isA4 ? '9px' : '8px'}; 
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="receipt-header">
            <h1>${companyName}</h1>
            <div class="sub-info">${companyAddress}<br>${companyPhone}</div>
        </div>
        <div class="info-line">
            <span class="left">${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="right">${saleData.customer?.startsWith('Perakende-') ? 'Perakende Satış' : 'Toptan Satış'}</span>
        </div>
        <table class="items">
            <thead>
                <tr>
                    <th class="col-name">URUN</th>
                    <th class="col-qty">ADET</th>
                    <th class="col-price">FIYAT</th>
                    <th class="col-total">TUTAR</th>
                </tr>
            </thead>
            <tbody>
                ${(saleData.items || []).map(item => {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const lineTotal = price * qty * (1 - discount / 100);
            return `<tr>
                        <td class="col-name">${item.name || ''}</td>
                        <td class="col-qty">${qty.toFixed(0)}</td>
                        <td class="col-price">${price.toFixed(2)}</td>
                        <td class="col-total">${lineTotal.toFixed(2)}</td>
                    </tr>`;
        }).join('')}
            </tbody>
        </table>
        <div class="total-section">
            <span class="total-amount">TOPLAM: ${(saleData.total || 0).toFixed(2)} TL</span>
        </div>
        <div class="footer-msg">Bizi tercih ettiğiniz için teşekkürler!</div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank', `width=${isA4 ? 800 : 600},height=${isA4 ? 1000 : 800}`);
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 200);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-100 relative" style={{ fontFamily: "'Manrope', sans-serif" }}>

            {/* Modern Loading Screen - Variant 2 */}
            {loading && (
                <div className="absolute inset-0 z-[100] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-fashion transition-all duration-500">
                    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center animate-fade-in-up">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl animate-pulse-glow"></div>
                            <div className="relative w-24 h-24 flex items-center justify-center border border-slate-100 dark:border-slate-800 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-blue-600 font-extralight scale-125">
                                    shopping_bag
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-center leading-relaxed text-slate-900 dark:text-slate-100">
                            Ürünler <br />
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

            {/* Header removed - using Global Layout Header */}

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Cart) */}
                <aside className="w-[500px] bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl shadow-slate-200/50">
                    <div className="px-3 py-2 bg-white border-b border-slate-200 shadow-sm z-20">
                        <div className="grid grid-cols-4 gap-2">
                            {/* 1. Customer Select (1 col) */}
                            <button
                                className="col-span-1 border rounded-lg p-1 flex flex-col items-center justify-center gap-1 transition-all group bg-blue-50 border-blue-200 hover:border-blue-500 hover:bg-blue-100"
                                onClick={() => setShowCustomerModal(true)}
                                title="Müşteri Seç"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-sm">person_add</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-blue-700 text-center leading-tight">MÜŞTERİ<br />SEÇ</span>
                            </button>

                            {/* 2. Customer Name Display (1 col) */}
                            <div className={`col-span-1 border rounded-lg flex flex-col items-center p-0 overflow-hidden transition-all duration-300 ${customer !== 'Toptan Satış'
                                ? 'bg-yellow-50 border-[#062206] shadow-[0_0_15px_#062206] animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite]'
                                : 'bg-slate-50 border-slate-200'}`}>
                                <span className="w-full text-center text-[9px] text-slate-400 font-bold uppercase leading-none pt-1.5 pb-0.5 border-b border-black/5 bg-black/5">MÜŞTERİ</span>
                                <div className="flex-1 w-full flex items-center justify-center px-1">
                                    <span className={`text-[13px] font-extrabold text-center leading-tight line-clamp-2 break-words ${customer !== 'Toptan Satış' ? 'text-[#062206]' : 'text-slate-700'}`}>
                                        {customer}
                                    </span>
                                </div>
                            </div>

                            {/* 3. Hold Button (1 col) */}
                            <button
                                onClick={holdSale}
                                className="col-span-1 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center p-2 hover:bg-orange-100 hover:border-orange-400 transition-all"
                                title="Satışı Beklemeye Al"
                            >
                                <span className="text-xs font-extrabold text-orange-700 text-center leading-tight">BEKLEMEYE<br />AL</span>
                            </button>

                            {/* 4. Waitlist Button (1 col) */}
                            <button
                                onClick={() => setShowWaitlistModal(true)}
                                className="col-span-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-2 hover:bg-slate-100 hover:border-slate-400 transition-all relative"
                                title="Bekleyen Satışlar"
                            >
                                {heldSales.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">{heldSales.length}</span>
                                )}
                                <span className="text-xs font-extrabold text-slate-700 text-center leading-tight">BEKLEME<br />LİSTESİ</span>
                            </button>
                        </div>

                        {/* Barcode Input */}
                        <div className="relative group mt-2">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">barcode_scanner</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                placeholder="Barkod Okutun veya Stok Kodu Yazın"
                                type="text"
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                onKeyDown={handleBarcodeInput}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex items-center px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white border-b border-slate-100">
                        <span className="flex-1">Sepetteki Ürünler</span>
                        <span className="w-16 text-center">Adet</span>
                        <span className="w-24 text-right">Tutar</span>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-0 py-0 divide-y divide-slate-100">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">shopping_basket</span>
                                <p className="text-sm font-medium">Sepet boş</p>
                            </div>
                        ) : (
                            cart.map((item, index) => (
                                <div
                                    key={item.id || `${item.stock_code}-${index}`}
                                    ref={el => cartItemsRef.current[index] = el}
                                    className={`flex items-center gap-1.5 pr-2 py-0.5 hover:bg-slate-50 group transition-all border-l-4 ${selectedCartIndex === index ? 'bg-green-100 border-green-500' : 'border-transparent pl-1'}`}
                                    onClick={() => setSelectedCartIndex(index)}
                                >
                                    <div className="w-8 h-8 bg-slate-100 overflow-hidden flex-shrink-0 border-r border-slate-100">
                                        {item.image_url ? (
                                            <img
                                                alt={item.name}
                                                loading="lazy"
                                                className="w-full h-full object-contain"
                                                src={item.image_url}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div className={`w-full h-full flex-col items-center justify-center bg-slate-100 text-slate-400 ${item.image_url ? 'hidden' : 'flex'}`}>
                                            <span className="text-[6px] text-center leading-tight font-medium">Görsel<br />Yok</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 pl-0.5">
                                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1 leading-tight">{item.name}</h4>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {item.discount_rate > 0 ? (
                                                <div className="flex flex-col leading-none">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm text-slate-400 line-through decoration-red-400">{item.price?.toFixed(2)} ₺</span>
                                                        <p className="text-xl font-bold text-emerald-600">
                                                            {(item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-bold text-red-700 bg-yellow-300 px-2 py-0.5 rounded">
                                                        %{item.discount_rate} iskonto uygulanmıştır
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xl font-bold text-blue-600">{item.price?.toFixed(2)} ₺</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-16 flex items-center justify-center">
                                        <div
                                            className="h-8 px-2 bg-slate-100 rounded flex items-center justify-center text-lg font-bold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setModalValue(item.quantity);
                                                setSelectedCartIndex(index);
                                                setShowQuantityModal(true);
                                                // Focus and select is handled in the modal's input autoFocus + onFocus
                                            }}
                                        >
                                            {item.quantity}
                                        </div>
                                    </div>
                                    <div className="w-24 text-right">
                                        <span className="text-lg font-bold text-red-500">
                                            {(item.price * item.quantity * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-rose-500 transition-all ml-1"
                                    >
                                        <span className="material-symbols-outlined text-xl">close</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                        <div className="space-y-0 mb-4">
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">TOPLAM</span>
                                <span className="text-3xl font-extrabold text-slate-900 tracking-tighter">{calculateTotal().toFixed(2)} ₺</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {/* Row 1: Payment Methods */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => completeSale('Nakit')}
                                    className="flex items-center justify-center p-2 bg-emerald-50 border border-emerald-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-100 hover:shadow-md transition-all"
                                >
                                    <span className="text-base font-extrabold text-emerald-700 whitespace-nowrap">NAKİT</span>
                                </button>
                                <button
                                    onClick={() => completeSale('POS')}
                                    className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-100 hover:shadow-md transition-all"
                                >
                                    <span className="text-base font-extrabold text-blue-700 whitespace-nowrap">KREDİ KARTI</span>
                                </button>
                                <button
                                    onClick={() => completeSale('Açık Hesap')}
                                    disabled={!customers.find(c => c.name === customer)}
                                    className={`flex items-center justify-center p-2 rounded-xl transition-all ${customers.find(c => c.name === customer)
                                        ? 'bg-orange-50 border border-orange-200 hover:border-orange-500 hover:bg-orange-100 hover:shadow-md'
                                        : 'bg-slate-50 border border-slate-200 opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    <span className={`text-base font-extrabold whitespace-nowrap ${customers.find(c => c.name === customer) ? 'text-orange-700' : 'text-slate-400'}`}>VERESİYE</span>
                                </button>
                            </div>

                            {/* Row 2: Item Actions */}
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].quantity);
                                            setShowQuantityModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">MİKTAR DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].price);
                                            setShowPriceModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">FİYAT DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
                                            setModalValue(cart[selectedCartIndex].discount_rate || 0);
                                            setShowDiscountModal(true);
                                        } else {
                                            alert('Lütfen sepetten bir ürün seçin');
                                        }
                                    }}
                                    className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-slate-700">İSKONTO DÜZENLE</span>
                                </button>
                                <button
                                    onClick={() => { if (window.confirm('Sepeti temizle?')) setCart([]); }}
                                    className="flex items-center justify-center p-3 bg-rose-50 border border-rose-200 rounded-lg hover:border-rose-400 hover:bg-rose-100 transition-all"
                                >
                                    <span className="text-sm font-extrabold text-rose-700">SEPETİ BOŞALT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">

                    {/* Categories */}
                    <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 bg-white flex-none z-10">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-6 py-4 rounded-2xl text-sm font-bold whitespace-nowrap transition-all shadow-sm active:scale-95 ${selectedCategory === cat
                                    ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800 ring-2 ring-slate-900 ring-offset-2'
                                    : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar (Main) */}
                    <div className="mt-2 px-6">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                placeholder="Ürün adı ile ara..."
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                ref={searchInputRef}
                            />
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar p-6 bg-slate-50/50 border-b border-slate-200 shadow-inner h-auto">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                            {displayedProducts.map(product => (
                                <ProductCard
                                    key={product.id || product.stock_code}
                                    product={product}
                                    onAddToCart={addToCart}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Stats / Actions (Bottom Right) */}
                    <div className="flex-none p-2 bg-white flex items-center justify-between gap-4 border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 relative">
                        {/* New Left Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowReturnModal(true)}
                                className="px-3 py-2 bg-red-700 text-white rounded-lg font-bold text-xs hover:bg-red-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                                İade Yap
                            </button>
                            <button
                                onClick={() => setShowNewProductModal(true)}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">add_box</span>
                                Yeni Ürün
                            </button>
                            <button
                                onClick={() => setShowNewCustomerModal(true)}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                                Yeni Müşteri
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentTransactionType('payment');
                                    setShowPaymentModal(true);
                                }}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">payments</span>
                                Müşteriden Ödeme Al
                            </button>
                            <button
                                onClick={() => setShowShortcutGroupsModal(true)}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">edit_square</span>
                                Satış Ekranı Düzenle
                            </button>
                            <button
                                onClick={() => setShowKeyboardShortcutsModal(true)}
                                className="px-3 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">keyboard</span>
                                Kısayollar
                            </button>
                        </div>

                        {/* Right Side: Pagination + Count Info */}
                        <div className="flex items-center gap-2">
                            {/* Pagination Controls */}
                            {displayLimit !== 'Hepsi' && filteredProducts.length > parseInt(displayLimit) && (
                                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded-md hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        title="Önceki Sayfa"
                                    >
                                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                                    </button>
                                    <span className="text-xs font-black text-slate-700 w-16 text-center">
                                        Sayfa {currentPage} / {Math.ceil(filteredProducts.length / parseInt(displayLimit))}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / parseInt(displayLimit)), p + 1))}
                                        disabled={currentPage >= Math.ceil(filteredProducts.length / parseInt(displayLimit))}
                                        className="p-1 rounded-md hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                        title="Sonraki Sayfa"
                                    >
                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                    </button>
                                </div>
                            )}

                            {/* Product Count Info */}
                            <div className="flex items-center gap-3 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">
                                <span className="text-orange-800 font-bold text-xs">Görüntüle:</span>
                                <select
                                    value={displayLimit}
                                    onChange={handleLimitChange}
                                    className="bg-white border-2 border-orange-200 rounded-md px-2 py-1 text-orange-900 font-bold outline-none focus:border-orange-500 cursor-pointer shadow-sm hover:border-orange-400 transition-colors text-xs"
                                >
                                    <option value="100">100 Ürün</option>
                                    <option value="200">200 Ürün</option>
                                    <option value="500">500 Ürün</option>
                                    <option value="1000">1000 Ürün</option>
                                    <option value="Hepsi">Hepsi</option>
                                </select>
                                <span className="text-orange-600 text-xs font-extrabold ml-1">
                                    (Toplam: {filteredProducts.length} Ürün)
                                </span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* MODALS */}

            {/* Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-6 py-5 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">Müşteri Seç</h3>
                            <button onClick={() => setShowCustomerModal(false)} className="text-white hover:bg-white/20 rounded p-1"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-4 bg-slate-50 border-b">
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-slate-200"
                                placeholder="Müşteri ara..."
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <div
                                onClick={() => { setShowRetailCustomerModal(true); setTaxPayerResult(null); setRetailCustomerForm(defaultRetailForm); }}
                                className="mb-2 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:border-amber-500 hover:bg-amber-100 cursor-pointer flex justify-between items-center group transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined">person_pin</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-amber-900 block">Perakende Müşteri</span>
                                        <span className="text-xs text-amber-700">Adres ve TC Kimlik bilgileri ile</span>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-amber-300 group-hover:text-amber-600 transition-colors">arrow_forward_ios</span>
                            </div>
                            <div
                                onClick={() => { setCustomer('Toptan Satış'); setShowCustomerModal(false); }}
                                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group"
                            >
                                <span className="font-bold text-slate-800">Toptan Satış (Varsayılan)</span>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500">check_circle</span>
                            </div>
                            {customers
                                .filter(c => c.name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.phone?.includes(customerSearchQuery))
                                .map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => { setCustomer(c.name); setShowCustomerModal(false); }}
                                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 cursor-pointer flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="font-bold text-slate-800">{c.name}</p>
                                            <p className="text-xs text-slate-500">{c.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{c.balance?.toFixed(2)} ₺</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="p-4 border-t bg-gray-50">
                        </div>
                    </div>
                </div>
            )}


            {/* Quantity Modal */}
            {showQuantityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowQuantityModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Miktar Düzenle
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(1, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                        />
                                        <div className="h-1 w-8 bg-blue-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'quantity', parseInt(modalValue) || 1)}
                                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price Modal */}
            {showPriceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowPriceModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Fiyat Düzenle
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(0, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                        />
                                        <div className="h-1 w-8 bg-blue-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'price', parseFloat(modalValue) || 0)}
                                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    İskonto Ekle (%)
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {cart[selectedCartIndex]?.name}
                                </p>
                            </div>
                            <div className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        onClick={() => setModalValue(prev => Math.max(0, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            type="number"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0);
                                                }
                                            }}
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            autoFocus
                                            placeholder="%"
                                        />
                                        <div className="h-1 w-8 bg-orange-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        onClick={() => setModalValue(prev => Math.min(100, (parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    onClick={() => updateCartItem(selectedCartIndex, 'discount_rate', parseFloat(modalValue) || 0)}
                                    className="w-full h-16 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Kaydet</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">check</span>
                                </button>
                            </div>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Waitlist Modal - Bekleme Listesi */}
            {showWaitlistModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white w-[500px] max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Bekleme Listesi</h3>
                            <button onClick={() => setShowWaitlistModal(false)} className="text-white/60 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {heldSales.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">
                                    <span className="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
                                    <p>Bekleyen satış yok</p>
                                </div>
                            ) : (
                                heldSales.map((sale, index) => {
                                    const saleTotal = (sale.items || []).reduce((sum, item) => {
                                        const price = item.price * (1 - (item.discount_rate || 0) / 100);
                                        return sum + (price * item.quantity);
                                    }, 0);
                                    const customerName = sale.customer_name || sale.customer || 'Toptan Satış';
                                    return (
                                        <div key={sale.id || index} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-blue-400 transition-all flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-bold text-slate-800 truncate">{customerName}</p>
                                                    <p className="font-extrabold text-lg text-red-600">{saleTotal.toFixed(2)} ₺</p>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <span className="text-sm font-bold">{new Date(sale.created_at).toLocaleDateString('tr-TR')}</span>
                                                    <span className="text-sm font-bold">{new Date(sale.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-xs">• {sale.items?.length || 0} ürün</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => { restoreHeldSale(sale); setShowWaitlistModal(false); }}
                                                    className="px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
                                                >
                                                    Yükle
                                                </button>
                                                <button
                                                    onClick={() => deleteHeldSale(sale.id)}
                                                    className="px-2 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showAskQuantityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/20 relative">
                        <div className="p-8 flex flex-col items-center text-center">
                            <button
                                onClick={() => setShowAskQuantityModal(false)}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none p-1 z-10"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                            <div className="space-y-2 mb-8">
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">
                                    Miktar Giriniz
                                </h2>
                                <p className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">
                                    {productToAdd?.name}
                                </p>
                            </div>
                            <form onSubmit={confirmAddQuantity} className="w-full">
                                <div className="flex items-center justify-between w-full mb-10 px-2">
                                    <button
                                        type="button"
                                        onClick={() => setAskQuantityValue(prev => Math.max(1, (parseFloat(prev) || 0) - 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">remove</span>
                                    </button>
                                    <div className="flex-1 flex flex-col items-center">
                                        <input
                                            className="w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none"
                                            type="number"
                                            value={askQuantityValue}
                                            onChange={(e) => setAskQuantityValue(e.target.value)}
                                            autoFocus
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    setShowAskQuantityModal(false);
                                                }
                                            }}
                                        />
                                        <div className="h-1 w-8 bg-emerald-500 rounded-full mt-1 opacity-20"></div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAskQuantityValue(prev => ((parseFloat(prev) || 0) + 1).toString())}
                                        className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 active:scale-90 transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-3xl">add</span>
                                    </button>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold text-lg rounded-[1.25rem] shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center group"
                                >
                                    <span>Ekle</span>
                                    <span className="material-symbols-outlined ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">chevron_right</span>
                                </button>
                            </form>
                        </div>
                        <div className="pb-2 flex justify-center opacity-10">
                            <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}



            {/* Undefined Product Modal */}
            {
                showUndefinedProductModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">add_circle</span>
                                    Hızlı Ürün Ekle
                                </h3>
                                <button onClick={() => setShowUndefinedProductModal(false)} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Step 1: Name */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 0 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">1. Ürün İsmi</label>
                                    <input
                                        ref={undefinedNameRef}
                                        disabled={undefinedProductStep !== 0}
                                        value={undefinedProductData.name}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, name: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.name.trim()) {
                                                setUndefinedProductStep(1);
                                                setTimeout(() => undefinedQtyRef.current?.focus(), 100);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="Örn: Çay"
                                    />
                                </div>

                                {/* Step 2: Quantity */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 1 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">2. Adet</label>
                                    <input
                                        ref={undefinedQtyRef}
                                        type="number"
                                        disabled={undefinedProductStep !== 1}
                                        value={undefinedProductData.quantity}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, quantity: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.quantity) {
                                                setUndefinedProductStep(2);
                                                setTimeout(() => undefinedPriceRef.current?.focus(), 100);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="1"
                                    />
                                </div>

                                {/* Step 3: Price */}
                                <div className={`space-y-2 transition-all duration-300 ${undefinedProductStep === 2 ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                                    <label className="block text-sm font-bold text-slate-700">3. Fiyat (TL)</label>
                                    <input
                                        ref={undefinedPriceRef}
                                        type="number"
                                        disabled={undefinedProductStep !== 2}
                                        value={undefinedProductData.price}
                                        onChange={(e) => setUndefinedProductData({ ...undefinedProductData, price: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && undefinedProductData.price) {
                                                const newProduct = {
                                                    id: `TEMP-${Date.now()}`,
                                                    stock_code: 'TANIMSIZ',
                                                    name: undefinedProductData.name,
                                                    price: parseFloat(undefinedProductData.price),
                                                    quantity: parseFloat(undefinedProductData.quantity),
                                                    discount_rate: 0
                                                };

                                                // Add to cart
                                                const existingIndex = cart.findIndex(item => item.name === newProduct.name && item.price === newProduct.price);
                                                if (existingIndex >= 0) {
                                                    const newCart = [...cart];
                                                    newCart[existingIndex].quantity += newProduct.quantity;
                                                    setCart(newCart);
                                                    setSelectedCartIndex(existingIndex);
                                                } else {
                                                    setCart([...cart, newProduct]);
                                                    setSelectedCartIndex(cart.length);
                                                }

                                                setShowUndefinedProductModal(false);
                                                setUndefinedProductData({ name: '', quantity: 1, price: '' });
                                                setUndefinedProductStep(0);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:bg-white outline-none font-bold text-lg disabled:opacity-60"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowUndefinedProductModal(false)}
                                    className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-lg"
                                >
                                    İptal
                                </button>
                                {undefinedProductStep > 0 && (
                                    <button
                                        onClick={() => setUndefinedProductStep(prev => prev - 1)}
                                        className="px-4 py-2 text-violet-600 font-bold hover:bg-violet-50 rounded-lg"
                                    >
                                        Geri
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Success Message Toaster */}
            {
                successMessage && (
                    <div className="fixed bottom-10 right-10 z-50 bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl text-lg font-bold animate-pulse flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        {successMessage}
                    </div>
                )
            }

            <ProductFormModal
                isOpen={showNewProductModal}
                onClose={() => setShowNewProductModal(false)}
                onSuccess={loadProducts}
                initialValues={newProductInitialValues}
            />

            <CustomerFormModal
                isOpen={showNewCustomerModal}
                onClose={() => setShowNewCustomerModal(false)}
                onSuccess={loadCustomers}
            />

            <PaymentFormModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onSuccess={loadCustomers}
                transactionType={paymentTransactionType}
                customers={customers}
            />

            <ProductSelectionModal
                isOpen={showProductSelectionModal}
                products={productMatches}
                onClose={() => setShowProductSelectionModal(false)}
                onSelect={(product) => {
                    addToCart(product);
                    setShowProductSelectionModal(false);
                }}
            />

            {/* Retail Customer Modal - 2026 Modern Design */}
            {
                showRetailCustomerModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                            {/* Compact Header */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                                        <span className="text-xl">👤</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Perakende Müşteri</h3>
                                        <p className="text-slate-400 text-sm">Hızlı satış için bilgileri doldurun</p>
                                    </div>
                                </div>
                            </div>

                            {/* Form Content - 2 Column Layout */}
                            <form onSubmit={handleRetailCustomerSubmit} className="p-6 bg-gradient-to-b from-slate-50 to-white">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    {/* Sol Sütun */}
                                    {/* İsim Soyisim */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">
                                            İsim Soyisim <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={retailCustomerForm.name}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Müşteri adını giriniz..."
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    {/* TC / Vergi No + Müşteriyi Getir */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">
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
                                                className="flex-1 px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider"
                                                placeholder="VKN (10) veya TCKN (11)"
                                            />
                                            {retailCustomerForm.tax_number.trim().length >= 10 && (
                                                <button
                                                    type="button"
                                                    onClick={handleTaxPayerQuery}
                                                    disabled={taxPayerLoading}
                                                    className="px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                                                >
                                                    {taxPayerLoading ? (
                                                        <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span> Sorgulanıyor</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-base">person_search</span> Müşteriyi Getir</>
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

                                    {/* Telefon */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">Telefon</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={retailCustomerForm.phone}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="0532 xxx xx xx"
                                        />
                                    </div>

                                    {/* E-posta */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">E-posta</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={retailCustomerForm.email}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="ornek@email.com"
                                        />
                                    </div>

                                    {/* Vergi Dairesi */}
                                    <div className="space-y-1 relative">
                                        <label className="block text-sm font-semibold text-slate-700">
                                            Vergi Dairesi
                                            {retailCustomerForm.tax_number.replace(/\D/g, '').length === 11 && (
                                                <span className="text-xs text-slate-400 font-normal ml-2">(TCKN için gerekli değil)</span>
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
                                            className={`w-full px-4 py-3 text-base rounded-xl border-2 outline-none transition-all placeholder:text-slate-400 ${
                                                retailCustomerForm.tax_number.replace(/\D/g, '').length === 11
                                                    ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                                                    : 'border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500'
                                            }`}
                                            placeholder={retailCustomerForm.tax_number.replace(/\D/g, '').length === 11 ? 'TCKN için gerekli değil' : 'Vergi dairesi adı yazın...'}
                                        />
                                        {showTaxOfficeDropdown && filteredTaxOffices.length > 0 && retailCustomerForm.tax_number.replace(/\D/g, '').length !== 11 && (
                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                {filteredTaxOffices.map((office, idx) => (
                                                    <div
                                                        key={office.TaxOfficeCode || idx}
                                                        className="px-4 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                                                        onMouseDown={() => {
                                                            setRetailCustomerForm(prev => ({ ...prev, tax_office: office.TaxOfficeName }));
                                                            setShowTaxOfficeDropdown(false);
                                                            setTaxOfficeSearch('');
                                                        }}
                                                    >
                                                        <span className="font-medium text-slate-700">{office.TaxOfficeName}</span>
                                                        <span className="text-slate-400 ml-2 text-xs">({office.TaxOfficeCode})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Adres */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">Adres</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={retailCustomerForm.address}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Adres bilgisi..."
                                        />
                                    </div>

                                    {/* İl */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">İl</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={retailCustomerForm.city}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Adana"
                                        />
                                    </div>

                                    {/* İlçe */}
                                    <div className="space-y-1">
                                        <label className="block text-sm font-semibold text-slate-700">İlçe</label>
                                        <input
                                            type="text"
                                            name="district"
                                            value={retailCustomerForm.district}
                                            onChange={handleRetailCustomerChange}
                                            className="w-full px-4 py-3 text-base rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Seyhan"
                                        />
                                    </div>
                                </div>

                                {/* Ödeme Tipi - Full width */}
                                <div className="mt-4 space-y-1">
                                    <label className="block text-sm font-semibold text-slate-700">Ödeme Tipi</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Kredi Kartı', 'Havale', 'Nakit'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setRetailPaymentType(type)}
                                                className={`py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 border-2 ${
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

                                {/* Buttons */}
                                <div className="flex gap-3 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => setShowRetailCustomerModal(false)}
                                        className="flex-1 py-4 text-base font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDirectInvoice}
                                        disabled={invoiceLoading}
                                        className="flex-[2] py-4 text-base font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {invoiceLoading ? (
                                            <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Gönderiliyor...</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-lg">receipt_long</span> Direkt Fatura Kes</>
                                        )}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-4 text-base font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        Tamamla
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
                details={statusModal.details}
                actionButton={statusModal.actionButton}
            />

            {/* Debt Limit Alert Modal */}
            <DebtLimitAlert
                isOpen={showDebtLimitAlert}
                onClose={() => setShowDebtLimitAlert(false)}
                data={debtLimitAlertData}
            />

            <ReturnModal
                isOpen={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                onSuccess={() => {
                    loadProducts();
                    loadCustomers();
                }}
            />

            <ShortcutGroupsModal
                isOpen={showShortcutGroupsModal}
                onClose={() => {
                    setShowShortcutGroupsModal(false);
                    loadShortcuts();
                }}
            />

            {showKeyboardShortcutsModal && (
                <KeyboardShortcutsModal
                    onClose={() => setShowKeyboardShortcutsModal(false)}
                />
            )}

        </div>
    );
}
