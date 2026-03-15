import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { invoicesAPI, productsAPI, customersAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import JSZip from 'jszip';
import axios from 'axios';

export default function MobileInvoicesPage() {
    const { logout } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Tümü');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    // Processing States
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [productMatches, setProductMatches] = useState({});
    const [supplierMatch, setSupplierMatch] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Mobile Product Match Modal States
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [matchModalData, setMatchModalData] = useState(null); // { index, line }
    const [matchSearch, setMatchSearch] = useState('');


    // Price Check Modal States
    const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
    const [priceCheckProduct, setPriceCheckProduct] = useState(null);
    const [priceCheckSearch, setPriceCheckSearch] = useState('');
    const [showPriceCheckScanner, setShowPriceCheckScanner] = useState(false);
    const priceCheckScannerRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [invRes, prodRes, custRes] = await Promise.all([
                invoicesAPI.getAll(),
                productsAPI.getAll(),
                customersAPI.getAll()
            ]);
            setInvoices(invRes.data?.invoices || []);
            setProducts(prodRes.data?.products || []);
            setCustomers(custRes.data?.customers || []);
        } catch (error) {
            console.error('Veri yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const syncInvoices = async () => {
        setSyncing(true);
        try {
            const savedConfig = localStorage.getItem('birfatura_config');
            if (!savedConfig) {
                alert('API ayarları eksik. Lütfen ayarlardan BirFatura entegrasyonunu kontrol edin.');
                setSyncing(false);
                return;
            }

            // Trigger sync on backend via simple fetch if needed, or just reload
            // For now assuming the button just refreshes data as per original code, 
            // but normally you might want to call invoicesAPI.sync() if it exists.
            alert('Senkronizasyon kontrol ediliyor...');
            await loadData();
        } catch (error) {
            alert('Senkronizasyon hatası: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    const statuses = ['Tümü', 'Bekliyor', 'İşlendi', 'İşlenmeyecek'];

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchTerm ||
            inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Tümü' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Bekliyor': return 'bg-amber-100 text-amber-700';
            case 'İşlendi': return 'bg-green-100 text-green-700';
            case 'İşlenmeyecek': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Stats
    const stats = {
        total: invoices.length,
        pending: invoices.filter(i => i.status === 'Bekliyor').length,
        processed: invoices.filter(i => i.status === 'İşlendi').length,
        totalAmount: invoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0)
    };

    // --- HELPERS FROM DESKTOP ---
    const getText = (parent, tagName) => {
        if (!parent) return "";
        const els = parent.getElementsByTagName("*");
        for (let i = 0; i < els.length; i++) {
            if (els[i].localName === tagName) return els[i].textContent;
        }
        return "";
    };

    const getTag = (parent, tagName) => {
        if (!parent) return null;
        const els = parent.getElementsByTagName("*");
        for (let i = 0; i < els.length; i++) {
            if (els[i].localName === tagName) return els[i];
        }
        return null;
    };

    const openProcessModal = async (invoice) => {
        setSelectedInvoice(invoice);
        setShowDetail(false); // Close simple detail modal
        setShowProcessModal(true); // Open process modal
        setDetailLoading(true);
        setInvoiceDetail(null);
        setProductMatches({});
        setSupplierMatch(null);

        try {
            // 1. Get credentials (ALWAYS DB)
            // Cihazlara kaydetme istenmediği için her seferinde DB'den çekiyoruz.
            const [k1, k2, k3] = await Promise.all([
                settingsAPI.get('birfatura_api_key'),
                settingsAPI.get('birfatura_secret_key'),
                settingsAPI.get('birfatura_integration_key')
            ]);

            if (!k1.data || !k2.data || !k3.data) {
                throw new Error("API ayarları veritabanında bulunamadı. Lütfen Ayarlar > Entegrasyon Ayarları bölümünden bilgileri girin.");
            }

            const config = {
                api_key: k1.data,
                secret_key: k2.data,
                integration_key: k3.data
            };

            // 2. Fetch Invoice XML
            const payload = {
                "documentUUID": invoice.uuid,
                "inOutCode": "IN",
                "systemTypeCodes": "EFATURA"
            };

            const response = await axios.post('/api/birfatura-proxy', {
                endpoint: 'OutEBelgeV2/DocumentDownloadByUUID',
                payload: payload,
                apiKey: config.api_key,
                secretKey: config.secret_key,
                integrationKey: config.integration_key
            });

            if (!response.data.Success) throw new Error(response.data.Message || "Fatura detayı alınamadı");

            const contentBase64 = response.data.Result?.content;
            if (!contentBase64) throw new Error("Dosya içeriği boş");

            // 3. Unzip & Parse
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(contentBase64, { base64: true });
            const xmlFileName = Object.keys(zipContent.files).find(name => name.toLowerCase().endsWith('.xml'));
            if (!xmlFileName) throw new Error("XML bulunamadı");
            const xmlString = await zipContent.files[xmlFileName].async("string");

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");

            // 4. Auto-Match Supplier
            const supplierParty = getTag(xmlDoc, "AccountingSupplierParty");
            const partyIdent = getTag(supplierParty, "PartyIdentification");
            const supplierTax = getText(partyIdent, "ID");
            const partyNameInfo = getTag(supplierParty, "PartyName");
            const supplierName = getText(partyNameInfo, "Name");

            // Fuzzy match supplier
            const matchedCustomer = customers.find(c =>
                c.name.toLowerCase().includes(supplierName.toLowerCase()) ||
                supplierName.toLowerCase().includes(c.name.toLowerCase())
            );
            if (matchedCustomer) setSupplierMatch(matchedCustomer.id);


            // 5. Parse Lines
            const invoiceLines = Array.from(xmlDoc.getElementsByTagName("*")).filter(el => el.localName === "InvoiceLine");
            const lines = invoiceLines.map(line => {
                const itemNode = getTag(line, "Item");
                const priceNode = getTag(line, "Price");
                const taxTotal = getTag(line, "TaxTotal");
                const taxSubtotal = getTag(taxTotal, "TaxSubtotal");
                const taxCat = getTag(taxSubtotal, "TaxCategory");

                const quantity = parseFloat(getText(line, "InvoicedQuantity") || 0);
                const unitPrice = parseFloat(getText(priceNode, "PriceAmount") || 0);
                const lineExtensionAmount = parseFloat(getText(line, "LineExtensionAmount") || 0);
                const vatRate = parseFloat(getText(taxCat, "Percent") || 0);

                // Discount calculation (if any)
                const allowanceCharge = getTag(line, "AllowanceCharge");
                let discount = 0;
                if (allowanceCharge && getText(allowanceCharge, "ChargeIndicator") === "false") {
                    discount = parseFloat(getText(allowanceCharge, "Amount") || 0);
                }

                // KDV Dahil Net Tutar
                const vatAmount = lineExtensionAmount * (vatRate / 100);
                const lineNet = lineExtensionAmount + vatAmount;

                return {
                    name: getText(itemNode, "Name"),
                    quantity,
                    unit_price: unitPrice * (1 + vatRate / 100), // KDV Dahil Birim Fiyat (Approx for display)
                    raw_unit_price: unitPrice,
                    line_net: lineNet,
                    vat_rate: vatRate,
                    discount
                };
            });

            setInvoiceDetail({
                lines,
                total_amount: parseFloat(invoice.total || 0),
                supplier_name: supplierName,
                supplier_tax: supplierTax // Add tax info
            });

            // 6. Auto-Match Products
            const initialMatches = {};
            lines.forEach((line, index) => {
                // Exact match attempts
                const found = products.find(p =>
                    p.name.toLowerCase() === line.name.toLowerCase() ||
                    (p.barcode && line.name.includes(p.barcode))
                );
                if (found) initialMatches[index] = found.id;
            });
            setProductMatches(initialMatches);

        } catch (error) {
            console.error("Detay hatası:", error);
            alert("Fatura detayları alınamadı: " + error.message);
            setShowProcessModal(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleMatch = (product) => {
        if (!matchModalData) return;
        setProductMatches(prev => ({
            ...prev,
            [matchModalData.index]: product.id
        }));
        setShowMatchModal(false);
        setMatchModalData(null);
    };

    const handleProcessInvoice = async () => {
        if (!invoiceDetail || !supplierMatch) {
            alert("Lütfen bir cari seçin.");
            return;
        }

        const allMatched = invoiceDetail.lines.every((_, index) => productMatches[index]);
        if (!allMatched) {
            alert("Lütfen tüm ürünleri eşleştirin.");
            return;
        }

        if (!confirm("Faturayı işlemek istediğinize emin misiniz?")) return;

        setProcessing(true);
        try {
            // A. Update Stocks
            for (let i = 0; i < invoiceDetail.lines.length; i++) {
                const line = invoiceDetail.lines[i];
                const productId = productMatches[i];
                const product = products.find(p => p.id == productId);

                if (product) {
                    const newStock = (product.stock || 0) + line.quantity;
                    // Note: Ideally update buying price too based on raw_unit_price
                    await productsAPI.updateStock(product.stock_code, { stock: newStock });
                }
            }

            // B. Add Transaction
            await customersAPI.addPurchaseTransaction({
                customer_id: supplierMatch,
                amount: invoiceDetail.total_amount,
                description: `Fatura İşleme (${selectedInvoice.invoice_number})`
            });

            // C. Update Status
            await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlendi');

            alert("Fatura başarıyla işlendi!");
            setShowProcessModal(false);
            loadData();

        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || error.message || "İşlem başarısız";
            alert("Hata: " + msg);
        } finally {
            setProcessing(false);
        }
    };

    const handleAddNewCustomer = async () => {
        if (!invoiceDetail?.supplier_name) return;

        if (!confirm(`"${invoiceDetail.supplier_name}" sisteme yeni cari olarak eklensin mi?`)) return;

        try {
            const newCustomer = {
                name: invoiceDetail.supplier_name,
                tax_number: invoiceDetail.supplier_tax || '',
                phone: '-',
                email: '',
                address: '-',
                balance: 0
            };

            const res = await customersAPI.add(newCustomer);
            if (res.data?.success) {
                // Refresh customers
                const custRes = await customersAPI.getAll();
                const newCustomers = custRes.data?.customers || [];
                setCustomers(newCustomers);

                // Try to find and select
                const created = newCustomers.find(c => c.name === newCustomer.name);
                if (created) {
                    setSupplierMatch(created.id);
                    alert("Cari eklendi ve seçildi.");
                } else {
                    alert("Cari eklendi ancak listede bulunamadı.");
                }
            } else {
                alert("Ekleme başarısız.");
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Ekleme başarısız";
            alert("Hata: " + msg);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 pb-24">
            {/* Header */}
            <header className="bg-gradient-to-r from-violet-600 to-purple-600 text-white sticky top-0 z-20 px-4 py-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Link to="/mobile-pos" className="text-2xl">←</Link>
                        <div>
                            <h1 className="text-lg font-bold">📄 Gelen Faturalar</h1>
                            <p className="text-violet-200 text-xs">{stats.total} fatura</p>
                        </div>
                    </div>
                    <button
                        onClick={syncInvoices}
                        disabled={syncing}
                        className="px-3 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {syncing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : '🔄'}
                        {syncing ? '' : 'Senkronize'}
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Fatura no veya tedarikçi ara..."
                    className="w-full px-4 py-2.5 bg-white/20 placeholder-violet-200 text-white rounded-xl focus:outline-none focus:bg-white/30"
                />
            </header>

            {/* Stats Cards */}
            <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-600">Bekleyen</p>
                    <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600">İşlendi</p>
                    <p className="text-xl font-bold text-green-700">{stats.processed}</p>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-violet-600">Toplam</p>
                    <p className="text-lg font-bold text-violet-700">₺{stats.totalAmount.toLocaleString('tr-TR')}</p>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {statuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors
                            ${statusFilter === status
                                ? 'bg-violet-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            <div className="px-4 py-2 space-y-3">
                {filteredInvoices.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        {invoices.length === 0 ? 'Fatura bulunamadı.' : 'Arama sonucu bulunamadı.'}
                    </div>
                ) : (
                    filteredInvoices.map((invoice, index) => (
                        <div
                            key={invoice.id || index}
                            onClick={() => { setSelectedInvoice(invoice); setShowDetail(true); }}
                            className="bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{invoice.supplier_name || 'Bilinmeyen Tedarikçi'}</h3>
                                    <p className="text-sm text-violet-600 font-mono">{invoice.invoice_number || '-'}</p>
                                </div>
                                <div className="text-right ml-3">
                                    <p className="text-lg font-bold text-emerald-600">
                                        ₺{parseFloat(invoice.total || 0).toLocaleString('tr-TR')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">{formatDate(invoice.date)}</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(invoice.status)}`}>
                                    {invoice.status || 'Bekliyor'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Invoice Detail Modal */}
            {showDetail && selectedInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowDetail(false)}>
                    <div
                        className="absolute bottom-0 w-full bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Fatura Detayı</h2>
                                <p className="text-sm text-violet-600 font-mono">{selectedInvoice.invoice_number}</p>
                            </div>
                            <button
                                onClick={() => setShowDetail(false)}
                                className="p-2 bg-gray-100 rounded-full text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Invoice Info */}
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-1">Tedarikçi</p>
                                <p className="font-semibold text-gray-800">{selectedInvoice.supplier_name || '-'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Tarih</p>
                                    <p className="font-semibold text-gray-800">{formatDate(selectedInvoice.date)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Durum</p>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(selectedInvoice.status)}`}>
                                        {selectedInvoice.status || 'Bekliyor'}
                                    </span>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center">
                                <p className="text-emerald-100 text-sm mb-1">Toplam Tutar</p>
                                <p className="text-3xl font-black text-white">
                                    ₺{parseFloat(selectedInvoice.total || 0).toLocaleString('tr-TR')}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            {(!selectedInvoice.status || selectedInvoice.status === 'Bekliyor') && (
                                <>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlenmeyecek');
                                                    setShowDetail(false);
                                                    loadData();
                                                } catch (err) {
                                                    alert('Hata: ' + err.message);
                                                }
                                            }}
                                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                                        >
                                            İşlenmeyecek
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await invoicesAPI.updateStatus(selectedInvoice.id, 'İşlendi');
                                                    setShowDetail(false);
                                                    loadData();
                                                } catch (err) {
                                                    alert('Hata: ' + err.message);
                                                }
                                            }}
                                            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-bold"
                                        >
                                            ✓ İşlendi
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => openProcessModal(selectedInvoice)}
                                        className="w-full mt-3 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30"
                                    >
                                        ⚡ Cariye ve Stoklara İşle
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Process Modal (Full Screen) */}
            {showProcessModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex flex-col animate-slide-up bg-gray-50">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-4 shadow-lg flex-none z-10">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                ⚡ Fatura İşle
                            </h2>
                            <button onClick={() => setShowProcessModal(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">✕</button>
                        </div>
                        {invoiceDetail && (
                            <div>
                                <p className="text-indigo-200 text-xs">{selectedInvoice?.invoice_number}</p>
                                <h3 className="font-semibold text-sm truncate">{invoiceDetail.supplier_name}</h3>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {detailLoading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="mt-3 text-gray-500 text-sm">Fatura Analiz Ediliyor...</p>
                            </div>
                        ) : invoiceDetail ? (
                            <>
                                {/* 1. Supplier Match */}
                                <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2">1. Cari Eşleştirme</h4>
                                    <select
                                        value={supplierMatch || ''}
                                        onChange={(e) => setSupplierMatch(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Cari Seçiniz --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddNewCustomer}
                                        className="mt-2 w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>➕</span> Yeni Cari Olarak Ekle
                                    </button>
                                </div>

                                {/* 2. Products */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase px-1">2. Ürün Eşleştirme</h4>
                                    {invoiceDetail.lines.map((line, index) => {
                                        const matchedId = productMatches[index];
                                        const matchedProduct = matchedId ? products.find(p => p.id == matchedId) : null;

                                        return (
                                            <div key={index} className={`bg-white rounded-xl p-3 shadow-sm border ${matchedProduct ? 'border-emerald-200' : 'border-red-200'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-800 text-sm">{line.name}</p>
                                                        <div className="mt-2 space-y-1 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">{line.quantity} Adet</span>
                                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">KDV %{line.vat_rate}</span>
                                                            </div>
                                                            <div className="flex justify-between text-gray-500">
                                                                <span>KDV Hariç Fiyat:</span>
                                                                <span className="font-mono">{line.raw_unit_price.toFixed(2)} TL</span>
                                                            </div>
                                                            <div className="flex justify-between text-gray-800 font-bold">
                                                                <span>KDV Dahil Fiyat:</span>
                                                                <span className="font-mono">{line.unit_price.toFixed(2)} TL</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900 text-sm">{line.line_net.toFixed(2)} TL</p>
                                                    </div>
                                                </div>

                                                {matchedProduct ? (
                                                    <div className="flex justify-between items-center bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">✓</div>
                                                            <div>
                                                                <p className="text-xs font-bold text-emerald-700">{matchedProduct.name}</p>
                                                                <p className="text-[10px] text-emerald-600">{matchedProduct.stock_code}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setMatchModalData({ index, line });
                                                                setShowMatchModal(true);
                                                                setMatchSearch("");
                                                            }}
                                                            className="text-xs text-emerald-600 underline px-2"
                                                        >
                                                            Değiştir
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setMatchModalData({ index, line });
                                                            setShowMatchModal(true);
                                                            setMatchSearch(line.name); // Auto search
                                                        }}
                                                        className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100 flex items-center justify-center gap-1"
                                                    >
                                                        ⚠️ Eşleştir
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-10 text-gray-500">Fatura verisi yüklenemedi.</div>
                        )}
                    </div>

                    {/* Footer */}
                    {invoiceDetail && (
                        <div className="bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-500 text-sm">Genel Toplam</span>
                                <span className="text-xl font-black text-gray-800">₺{invoiceDetail.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <button
                                onClick={handleProcessInvoice}
                                disabled={processing}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {processing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        İşleniyor...
                                    </>
                                ) : (
                                    <>🚀 Kaydet ve Stoklara İşle</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Match Modal (Full Screen) */}
            {showMatchModal && (
                <div className="fixed inset-0 bg-white z-[1100] flex flex-col animate-slide-up">
                    <div className="bg-white border-b border-gray-200 p-3 flex gap-2 items-center shadow-sm">
                        <button onClick={() => setShowMatchModal(false)} className="w-10 h-10 flex items-center justify-center text-2xl text-gray-500">←</button>
                        <div className="flex-1 relative">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-gray-100 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Ürün ara..."
                                value={matchSearch}
                                onChange={(e) => setMatchSearch(e.target.value)}
                            />
                            <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {matchModalData && (
                            <div className="bg-violet-50 p-3 rounded-lg mb-2 text-sm text-violet-800 border border-violet-100">
                                <span className="font-bold">Aranan:</span> {matchModalData.line.name}
                            </div>
                        )}

                        <div className="space-y-2">
                            {products
                                .filter(product => {
                                    const search = matchSearch.toLowerCase();
                                    return !search ||
                                        product.name.toLowerCase().includes(search) ||
                                        product.stock_code?.toLowerCase().includes(search) ||
                                        product.barcode?.includes(search);
                                })
                                .slice(0, 50) // Limit results
                                .map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleMatch(product)}
                                        className="w-full text-left bg-white p-3 rounded-xl border border-gray-100 shadow-sm active:bg-gray-50 flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{product.name}</p>
                                            <p className="text-xs text-gray-500 font-mono mt-0.5">{product.stock_code}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-violet-600 text-sm">₺{product.price}</p>
                                            <p className="text-[10px] text-gray-400">Stok: {product.stock}</p>
                                        </div>
                                    </button>
                                ))
                            }
                        </div>
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
                                                const scanner = new Html5Qrcode('invoice-price-check-scanner');
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
                                    <div id="invoice-price-check-scanner" className="w-full rounded-2xl overflow-hidden"></div>
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
                                            {priceCheckProduct.image_url && (
                                                <div className="flex justify-center">
                                                    <img src={priceCheckProduct.image_url} alt={priceCheckProduct.name} className="w-24 h-24 object-cover rounded-xl shadow-md" />
                                                </div>
                                            )}
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
                                            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 text-center shadow-lg shadow-emerald-500/30">
                                                <p className="text-emerald-100 text-sm mb-1">Satış Fiyatı</p>
                                                <p className="text-4xl font-black text-white">
                                                    {priceCheckProduct.price?.toFixed(2)} TL
                                                </p>
                                            </div>
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

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 px-1 z-30">
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
                <Link to="/mobile-customers" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">👥</span>
                    <span className="text-[10px]">Bakiyeler</span>
                </Link>
                <Link to="/mobile-sales" className="flex flex-col items-center text-gray-600 min-w-[40px]">
                    <span className="text-lg">📋</span>
                    <span className="text-[10px]">Satışlar</span>
                </Link>
                <Link to="/mobile-invoices" className="flex flex-col items-center text-blue-600 min-w-[40px]">
                    <span className="text-lg">📄</span>
                    <span className="text-[10px] font-bold">Faturalar</span>
                </Link>
                <button onClick={() => logout()} className="flex flex-col items-center text-red-500 min-w-[40px]">
                    <span className="text-lg">🚪</span>
                    <span className="text-[10px]">Çıkış</span>
                </button>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
