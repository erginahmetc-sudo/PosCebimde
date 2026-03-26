import { useState, useEffect, useMemo } from 'react';
import { salesAPI, productsAPI, settingsAPI, customersAPI, priceQuotesAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';

export default function SalesPage() {
    const [sales, setSales] = useState([]);
    const [invoiceLoadingSaleId, setInvoiceLoadingSaleId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Default Date: Last 7 Days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    // Filters
    const [filters, setFilters] = useState({
        searchTerm: '',
        stockCode: '',
        productName: '',
        barcode: '',
        minPrice: '',
        maxPrice: ''
    });

    // Show Deleted Sales Toggle
    const [showDeleted, setShowDeleted] = useState(false);

    // Transaction Type Filters (all ON by default)
    const [showSales, setShowSales] = useState(true);
    const [showReturns, setShowReturns] = useState(true);
    const [showPurchaseInvoices, setShowPurchaseInvoices] = useState(true);
    const [onlyRetail, setOnlyRetail] = useState(false);

    // Purchase Invoices (from customer_payments)
    const [purchaseInvoices, setPurchaseInvoices] = useState([]);
    const [selectedPurchaseInvoice, setSelectedPurchaseInvoice] = useState(null);

    // Fiyat Teklifleri
    const [showQuotesModal, setShowQuotesModal] = useState(false);
    const [quotes, setQuotes] = useState([]);
    const [quotesLoading, setQuotesLoading] = useState(false);
    const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
    const [showViewQuoteModal, setShowViewQuoteModal] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState(null);
    const [quoteForm, setQuoteForm] = useState({
        customer_id: '', customer_name: '', items: [], valid_until: '', notes: ''
    });
    const [allCustomers, setAllCustomers] = useState([]);
    const [quoteProductSearch, setQuoteProductSearch] = useState('');
    const [quoteSaving, setQuoteSaving] = useState(false);
    const [quoteConverting, setQuoteConverting] = useState(false);
    const [editingQuoteId, setEditingQuoteId] = useState(null); // null=yeni, id=düzenleme

    // Modal State
    const [selectedSale, setSelectedSale] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);

    // Product Search Modal State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]); // Lazy load
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productModalLoading, setProductModalLoading] = useState(false);
    const [tempQty, setTempQty] = useState(1);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

    // Visibility Settings
    const [showTotalSales, setShowTotalSales] = useState(true);
    const [showTotalRevenue, setShowTotalRevenue] = useState(true);

    useEffect(() => {
        loadSales();
        loadSettings();
    }, [showDeleted]);

    const loadSettings = async () => {
        try {
            const sRes = await settingsAPI.get('sales_show_total_sales');
            const rRes = await settingsAPI.get('sales_show_total_revenue');

            if (sRes.data !== undefined) setShowTotalSales(sRes.data === 'true' || sRes.data === true);
            if (rRes.data !== undefined) setShowTotalRevenue(rRes.data === 'true' || rRes.data === true);
        } catch (e) {
            console.error("Error loading sales settings", e);
        }
    };

    const loadSales = async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange.start) params.start_date = dateRange.start;
            if (dateRange.end) params.end_date = dateRange.end;
            if (showDeleted) params.only_deleted = true;

            const [salesRes, purchaseRes] = await Promise.all([
                salesAPI.getAll(params),
                customersAPI.getAllPurchaseInvoicesFromPayments().catch(() => ({ data: [] }))
            ]);
            setSales(salesRes.data?.sales || []);
            setPurchaseInvoices(purchaseRes.data || []);
        } catch (error) {
            console.error('Satışlar yüklenirken hata:', error);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    // Fatura Kes - Mevcut satış için BirFatura e-fatura/e-arşiv gönder
    const handleInvoiceForSale = async (sale) => {
        const storedName = sale.customer_name || sale.customerName || sale.customer || '';
        // Faturada "Perakende-" prefix'i kesinlikle görünmemeli — temizle
        const customerName = storedName.replace(/^Perakende-/i, '').trim();

        if (!customerName || customerName === 'Toptan Satış' || customerName === 'Misafir') return;

        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            alert('BirFatura ayarları bulunamadı. Ayarlar sayfasından API anahtarlarını kaydedin.');
            return;
        }

        setInvoiceLoadingSaleId(sale.id);

        try {
            // Müşteri bilgilerini çek - önce satış verisinden, yoksa customer tablosundan
            let customerData = {
                name: customerName,
                tax_number: sale.tax_number || '',
                tax_office: '',
                address: sale.address || '',
                phone: sale.phone || '',
                email: '',
                city: '',
                district: '',
            };

            // Kayıtlı müşteri ise detay bilgilerini çek
            if (sale.customer_id) {
                try {
                    const custRes = await customersAPI.getAll();
                    const cust = custRes.data?.customers?.find(c => c.id === sale.customer_id);
                    if (cust) {
                        customerData = {
                            // Faturada "Perakende-" prefix'i görünmemeli
                            name: cust.name.replace(/^Perakende-/i, '').trim() || customerName,
                            tax_number: cust.tax_number || sale.tax_number || '',
                            tax_office: cust.tax_office || '',
                            address: cust.address || sale.address || '',
                            phone: cust.phone || sale.phone || '',
                            email: cust.email || '',
                            city: cust.city || '',
                            district: cust.district || '',
                        };
                    }
                } catch (e) {
                    console.error('Müşteri bilgileri alınamadı:', e);
                }
            }

            const paymentTypeMap = {
                'Nakit': 'Nakit olarak Ödendi',
                'Kredi Kartı': 'Kredi Kartı ile Ödendi',
                'POS': 'Kredi Kartı ile Ödendi',
                'Havale': 'Havale-EFT ile ödendi',
            };

            const result = await birFaturaAPI.sendBasicInvoice({
                retailForm: customerData,
                cart: sale.items || [],
                paymentMethod: paymentTypeMap[sale.payment_method] || '',
                saleCode: sale.sale_code
            });

            if (result.success) {
                // birfatura_uuid kaydet - UUID yoksa bile "INVOICED" olarak işaretle
                const invoiceUuid = result.data?.Result?.UUID || result.data?.result?.uuid || result.data?.Result?.ETTN || 'INVOICED-' + Date.now();
                try {
                    await salesAPI.update(sale.sale_code, { birfatura_uuid: invoiceUuid });
                } catch (updateErr) {
                    console.error('birfatura_uuid güncellenemedi:', updateErr);
                }
                const pdfUrl = result.data?.Result?.PdfUrl || result.data?.result?.pdfUrl || null;
                if (pdfUrl) window.open(pdfUrl, '_blank');
                await loadSales();
            } else {
                alert('Fatura Hatası: ' + result.message);
            }
        } catch (error) {
            console.error('Fatura kesme hatası:', error);
            alert('Fatura kesme sırasında hata oluştu: ' + error.message);
        } finally {
            setInvoiceLoadingSaleId(null);
        }
    };

    // Open Modal
    const openDetailModal = (sale) => {
        setSelectedSale(sale);
        // Initialize Edit Form (Deep copy to avoid direct mutation)
        // Ensure items have vat_rate and UI flags
        const items = sale.items ? JSON.parse(JSON.stringify(sale.items)) : [];
        const enrichedItems = items.map(item => ({
            ...item,
            vat_rate: item.vat_rate !== undefined ? item.vat_rate : 20, // Default to 20% if missing
            is_vat_inc: true // Default UI toggle to "Included"
        }));

        setEditForm({
            ...sale,
            items: enrichedItems
        });
        setIsDetailModalOpen(true);
    };

    // Modal Actions
    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (index, field, value) => {
        setEditForm(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            // Recalculate item amount if needed (optional, simplistic)
            return { ...prev, items: newItems };
        });
    };

    const handleDeleteItem = (index) => {
        setEditForm(prev => {
            const newItems = prev.items.filter((_, i) => i !== index);
            return { ...prev, items: newItems };
        });
    };

    // Product Modal Helpers
    const openProductModal = async () => {
        setIsProductModalOpen(true);
        setProductSearchTerm('');
        setSelectedProductToAdd(null);
        setTempQty(1);

        if (allProducts.length === 0) {
            setProductModalLoading(true);
            try {
                const res = await productsAPI.getAll();
                setAllProducts(res.data?.products || []);
            } catch (error) {
                console.error("Ürünler yüklenirken hata:", error);
            } finally {
                setProductModalLoading(false);
            }
        }
    };

    const handleAddProductToSale = () => {
        if (!selectedProductToAdd) return;

        const newItem = {
            id: selectedProductToAdd.id,
            stock_code: selectedProductToAdd.stock_code,
            name: selectedProductToAdd.name,
            quantity: parseFloat(tempQty) || 1,
            price: parseFloat(selectedProductToAdd.price) || 0, // Default is Gross
            vat_rate: selectedProductToAdd.vat_rate !== undefined ? selectedProductToAdd.vat_rate : 20, // Default 20
            is_vat_inc: true // Default Included
        };

        setEditForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setIsProductModalOpen(false);
    };

    const filteredProductsForModal = useMemo(() => {
        if (!productSearchTerm) return allProducts;
        const lowerTerm = productSearchTerm.toLowerCase();
        return allProducts.filter(p =>
            p.name?.toLowerCase().includes(lowerTerm) ||
            p.stock_code?.toLowerCase().includes(lowerTerm) ||
            p.barcode?.toLowerCase().includes(lowerTerm)
        ).slice(0, 20); // Limit results
    }, [allProducts, productSearchTerm]);

    // Recalculate Total based on items (with VAT logic)
    const totals = useMemo(() => {
        if (!editForm?.items) return { net: 0, vat: 0, grand: 0, breakdown: {} };

        let netTotal = 0;
        let vatTotal = 0;
        const breakdown = {};

        editForm.items.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rawPrice = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;

            let unitGross, unitNet;
            if (item.is_vat_inc) {
                unitGross = rawPrice;
                unitNet = unitGross / (1 + rate / 100);
            } else {
                unitNet = rawPrice;
                unitGross = unitNet * (1 + rate / 100);
            }

            const lineGross = unitGross * qty * (1 - discount / 100);
            const lineNet = unitNet * qty * (1 - discount / 100);
            const lineVat = lineGross - lineNet;

            netTotal += lineNet;
            vatTotal += lineVat;

            if (!breakdown[rate]) breakdown[rate] = 0;
            breakdown[rate] += lineVat;
        });

        return {
            net: netTotal,
            vat: vatTotal,
            grand: netTotal + vatTotal,
            breakdown
        };
    }, [editForm?.items]);

    // ─── FIYAT TEKLİFLERİ ────────────────────────────────────────────────────
    const loadQuotes = async () => {
        setQuotesLoading(true);
        try {
            const res = await priceQuotesAPI.getAll();
            setQuotes(res.data?.data || []);
        } catch (e) { console.error(e); }
        finally { setQuotesLoading(false); }
    };

    const openQuotesModal = async () => {
        setShowQuotesModal(true);
        if (allCustomers.length === 0) {
            try { const r = await customersAPI.getAll(); setAllCustomers(r.data?.customers || []); } catch (e) {}
        }
        if (allProducts.length === 0) {
            setProductModalLoading(true);
            try { const r = await productsAPI.getAll(); setAllProducts(r.data?.products || []); } catch (e) {}
            finally { setProductModalLoading(false); }
        }
        loadQuotes();
    };

    const openNewQuoteModal = () => {
        const today = new Date();
        const future = new Date(); future.setDate(today.getDate() + 30);
        setQuoteForm({ customer_id: '', customer_name: '', items: [], valid_until: future.toISOString().split('T')[0], notes: '' });
        setQuoteProductSearch('');
        setEditingQuoteId(null);
        setShowNewQuoteModal(true);
    };

    const openEditQuoteModal = (q) => {
        setQuoteForm({
            customer_id: q.customer_id || '',
            customer_name: q.customer_name || '',
            items: (q.items || []).map(it => ({ ...it, is_vat_inc: it.is_vat_inc ?? true })),
            valid_until: q.valid_until || '',
            notes: q.notes || ''
        });
        setQuoteProductSearch('');
        setEditingQuoteId(q.id);
        setShowNewQuoteModal(true);
    };

    const quoteItemTotals = useMemo(() => {
        let net = 0, vat = 0;
        (quoteForm.items || []).forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rawPrice = parseFloat(item.price) || 0;
            const disc = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;
            const unitNet = item.is_vat_inc ? rawPrice / (1 + rate / 100) : rawPrice;
            const lineNet = unitNet * qty * (1 - disc / 100);
            net += lineNet;
            vat += lineNet * (rate / 100);
        });
        return { net, vat, grand: net + vat };
    }, [quoteForm.items]);

    const addProductToQuote = (product) => {
        setQuoteForm(prev => ({
            ...prev,
            items: [...prev.items, {
                id: product.id, stock_code: product.stock_code, name: product.name,
                quantity: 1, price: parseFloat(product.price) || 0,
                vat_rate: product.vat_rate ?? 20, discount_rate: 0, is_vat_inc: true
            }]
        }));
        setQuoteProductSearch('');
    };

    const removeQuoteItem = (idx) => setQuoteForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    const updateQuoteItem = (idx, field, val) => setQuoteForm(prev => {
        const items = [...prev.items]; items[idx] = { ...items[idx], [field]: val }; return { ...prev, items };
    });

    const handleSaveQuote = async () => {
        if (!quoteForm.customer_name.trim()) { alert('Müşteri adı zorunludur.'); return; }
        if (quoteForm.items.length === 0) { alert('En az bir ürün ekleyin.'); return; }
        setQuoteSaving(true);
        try {
            const payload = {
                ...quoteForm,
                subtotal: quoteItemTotals.net,
                vat_total: quoteItemTotals.vat,
                total: quoteItemTotals.grand
            };
            if (editingQuoteId) {
                await priceQuotesAPI.update(editingQuoteId, payload);
                // Refresh selectedQuote so view modal shows updated data
                setSelectedQuote(prev => prev ? { ...prev, ...payload, items: quoteForm.items } : prev);
            } else {
                await priceQuotesAPI.create(payload);
            }
            setShowNewQuoteModal(false);
            setEditingQuoteId(null);
            loadQuotes();
        } catch (e) { alert('Kayıt hatası: ' + e.message); }
        finally { setQuoteSaving(false); }
    };

    const handleDeleteQuote = async (id) => {
        if (!window.confirm('Bu teklifi silmek istediğinizden emin misiniz?')) return;
        try { await priceQuotesAPI.delete(id); loadQuotes(); } catch (e) { alert('Silme hatası: ' + e.message); }
    };

    const printQuote = (q) => {
        const savedConfig = localStorage.getItem('receipt_design_config');
        let ci = { name: 'Firma Adı', address: '', phone: '', logo_text: 'F', logo_url: '', showWatermark: true };
        if (savedConfig) { try { ci = { ...ci, ...JSON.parse(savedConfig) }; } catch (e) {} }

        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
        const validStr = q.valid_until ? new Date(q.valid_until).toLocaleDateString('tr-TR') : '—';

        const items = q.items || [];
        let net = 0, vat = 0;
        const itemsHtml = items.map((item, idx) => {
            const qty = parseFloat(item.quantity) || 0;
            const pr = parseFloat(item.price) || 0;
            const disc = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;
            const lineTotal = pr * qty * (1 - disc / 100);
            const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
            const lineNet = unitNet * qty * (1 - disc / 100);
            net += lineNet;
            vat += lineNet * (rate / 100);
            return `<tr>
                <td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; border-left:1px solid #000; font-size:10px;">
                    <span style="display:block;">${item.name.substring(0, 40)}</span>
                    ${item.stock_code ? `<span style="font-size:8px;color:#666;">${item.stock_code}</span>` : ''}
                </td>
                <td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; text-align:center; font-size:10px;">${qty}</td>
                <td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; text-align:right; font-size:10px;">${pr.toFixed(2)}</td>
                ${disc > 0 ? `<td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; text-align:center; font-size:10px; color:#c00;">%${disc}</td>` : `<td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; text-align:center; font-size:10px; color:#999;">—</td>`}
                <td style="padding:4px 4px; border-bottom:1px solid #000; border-top:1px solid #000; border-right:1px solid #000; text-align:right; font-weight:bold; font-size:10px;">${lineTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');
        const grand = net + vat;

        const vatBreakdown = {};
        items.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const pr = parseFloat(item.price) || 0;
            const disc = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;
            const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
            const lineNet = unitNet * qty * (1 - disc / 100);
            if (!vatBreakdown[rate]) vatBreakdown[rate] = 0;
            vatBreakdown[rate] += lineNet * (rate / 100);
        });
        const vatRows = Object.entries(vatBreakdown).map(([rate, amt]) =>
            `<div style="display:flex;justify-content:space-between;font-size:9px;color:#555;">
                <span>KDV %${rate}</span><span>${amt.toFixed(2)} TL</span>
            </div>`).join('');

        const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Fiyat Teklifi - ${q.quote_number}</title>
<style>
@page { size: A5; margin: 5mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background:#f1f5f9; }
@media print { body { background:white !important; } .no-print { display:none !important; } }
.a5 { width:100%; background:white; padding:3mm 3mm; margin:0 auto; display:flex; flex-direction:column; position:relative; overflow:hidden; }
.wm { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:160px; color:rgba(124,58,237,0.04); pointer-events:none; user-select:none; display:${ci.showWatermark ? 'block' : 'none'}; }
.th { text-transform:uppercase; font-size:0.62rem; letter-spacing:0.05em; color:#000; border:1px solid #000; padding:3px; text-align:center; }
.totals-block { page-break-inside: avoid; break-inside: avoid; }
</style>
</head>
<body style="padding:4mm;">
<div class="a5">
  <div class="wm">TEKLİF</div>

  <!-- HEADER -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3mm; position:relative; z-index:1;">
    <!-- Sol: Logo + Firma -->
    <div style="width:60%; display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
      ${ci.logo_url
        ? `<img src="${ci.logo_url}" style="height:28px; object-fit:contain; margin-bottom:2px;" />`
        : `<div style="background:#7c3aed; color:white; width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:13px; margin-bottom:2px;">${ci.logo_text}</div>`
      }
      <div style="font-size:13px; font-weight:900; color:#1e293b; text-transform:uppercase; letter-spacing:0.03em;">${ci.name}</div>
      ${ci.address ? `<div style="font-size:9px; color:#555; margin-top:1px;">${ci.address}</div>` : ''}
      ${ci.phone ? `<div style="font-size:9px; color:#555;">${ci.phone}</div>` : ''}
    </div>
    <!-- Sağ: Teklif Bilgisi -->
    <div style="width:38%; text-align:right;">
      <div style="font-size:22px; font-weight:900; color:#7c3aed; letter-spacing:0.08em; line-height:1;">TEKLİF</div>
      <div style="font-size:11px; font-weight:700; font-family:monospace; color:#1e293b; margin-top:2px;">${q.quote_number}</div>
      <div style="font-size:9px; color:#555; margin-top:3px;">Tarih: ${dateStr}</div>
      <div style="font-size:9px; color:${q.valid_until && new Date(q.valid_until) < new Date() ? '#dc2626' : '#059669'}; font-weight:700;">Geçerlilik: ${validStr}</div>
    </div>
  </div>

  <!-- MÜŞTERİ -->
  <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:6px; padding:2mm 3mm; margin-bottom:2mm; position:relative; z-index:1;">
    <div style="font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#7c3aed; margin-bottom:2px;">Teklif Verilen Firma</div>
    <div style="font-size:13px; font-weight:900; color:#1e293b;">${q.customer_name || '—'}</div>
  </div>

  <!-- ÜRÜN TABLOSU -->
  <div style="position:relative; z-index:1; flex:1;">
    <table style="width:100%; border-collapse:collapse; font-size:10px;">
      <thead>
        <tr>
          <th class="th" style="text-align:left; width:40%;">Ürün / Hizmet</th>
          <th class="th" style="width:10%;">Adet</th>
          <th class="th" style="width:17%; text-align:right;">Birim Fiyat</th>
          <th class="th" style="width:10%;">İsk.%</th>
          <th class="th" style="width:18%; text-align:right;">Tutar (TL)</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <!-- TOPLAMLAR -->
  <div class="totals-block" style="position:relative; z-index:1; margin-top:2mm; display:flex; justify-content:flex-end;">
    <div style="width:58%; border-top:2px solid #7c3aed; padding-top:2mm;">
      <div style="display:flex; justify-content:space-between; font-size:10px; color:#555; margin-bottom:2px;">
        <span>Ara Toplam (KDV Hariç)</span><span style="font-weight:600;">${net.toFixed(2)} TL</span>
      </div>
      ${vatRows}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3mm; padding-top:2mm; border-top:1px solid #ddd6fe;">
        <span style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:#7c3aed;">GENEL TOPLAM</span>
        <span style="font-size:18px; font-weight:900; color:#7c3aed;">${grand.toFixed(2)} TL</span>
      </div>
    </div>
  </div>

  ${q.notes ? `
  <!-- NOTLAR -->
  <div style="position:relative; z-index:1; margin-top:2mm; border-top:1px solid #e2e8f0; padding-top:2mm;">
    <div style="font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#92400e; margin-bottom:2px;">Notlar / Koşullar</div>
    <div style="font-size:9px; color:#555; white-space:pre-wrap;">${q.notes}</div>
  </div>` : ''}

</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 800); }</script>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=800,height=1100');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const printQuoteA4 = (q) => {
        const savedConfig = localStorage.getItem('receipt_design_config');
        let ci = { name: 'Firma Adı', address: '', phone: '', logo_text: 'F', logo_url: '', showWatermark: true };
        if (savedConfig) { try { ci = { ...ci, ...JSON.parse(savedConfig) }; } catch (e) {} }

        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
        const validStr = q.valid_until ? new Date(q.valid_until).toLocaleDateString('tr-TR') : '—';

        const items = q.items || [];
        let net = 0, vat = 0;
        const itemsHtml = items.map((item, idx) => {
            const qty = parseFloat(item.quantity) || 0;
            const pr = parseFloat(item.price) || 0;
            const disc = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;
            const lineTotal = pr * qty * (1 - disc / 100);
            const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
            const lineNet = unitNet * qty * (1 - disc / 100);
            net += lineNet;
            vat += lineNet * (rate / 100);
            return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px 8px; font-size:12px;">${idx + 1}</td>
                <td style="padding:6px 8px; font-size:12px; font-weight:600;">${item.name}${item.stock_code ? `<br/><span style="font-size:10px;color:#888;">${item.stock_code}</span>` : ''}</td>
                <td style="padding:6px 8px; font-size:12px; text-align:center;">${qty}</td>
                <td style="padding:6px 8px; font-size:12px; text-align:right; font-family:monospace;">${pr.toFixed(2)}</td>
                <td style="padding:6px 8px; font-size:12px; text-align:center; color:${disc > 0 ? '#dc2626' : '#999'};">${disc > 0 ? `%${disc}` : '—'}</td>
                <td style="padding:6px 8px; font-size:12px; text-align:center; color:#4f46e5; font-weight:700;">%${rate}</td>
                <td style="padding:6px 8px; font-size:12px; text-align:right; font-weight:700; font-family:monospace;">${lineTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');
        const grand = net + vat;

        const vatBreakdown = {};
        items.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const pr = parseFloat(item.price) || 0;
            const disc = parseFloat(item.discount_rate) || 0;
            const rate = parseFloat(item.vat_rate) || 0;
            const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
            const lineNet = unitNet * qty * (1 - disc / 100);
            if (!vatBreakdown[rate]) vatBreakdown[rate] = 0;
            vatBreakdown[rate] += lineNet * (rate / 100);
        });
        const vatRows = Object.entries(vatBreakdown).map(([rate, amt]) =>
            `<div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-bottom:3px;">
                <span>KDV %${rate}</span><span style="font-weight:600;">${amt.toFixed(2)} TL</span>
            </div>`).join('');

        const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Fiyat Teklifi A4 - ${q.quote_number}</title>
<style>
@page { size: A4; margin: 12mm 15mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background:white; }
@media print { body { background:white !important; } .no-print { display:none !important; } }
.totals-block { page-break-inside:avoid; break-inside:avoid; }
th { background:#1e293b; color:white; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; }
th:first-child { border-radius:6px 0 0 6px; }
th:last-child { border-radius:0 6px 6px 0; }
</style>
</head>
<body>
<div style="width:100%; background:white; padding:0; position:relative; overflow:hidden;">
  <!-- WATERMARK -->
  ${ci.showWatermark ? `<div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:220px; color:rgba(124,58,237,0.04); pointer-events:none; user-select:none; z-index:0;">TEKLİF</div>` : ''}

  <!-- HEADER -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8mm; position:relative; z-index:1; border-bottom:3px solid #7c3aed; padding-bottom:6mm;">
    <div style="display:flex; flex-direction:column; gap:4px;">
      ${ci.logo_url
        ? `<img src="${ci.logo_url}" style="height:40px; object-fit:contain; margin-bottom:4px;" />`
        : `<div style="background:#7c3aed; color:white; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; margin-bottom:4px;">${ci.logo_text}</div>`
      }
      <div style="font-size:18px; font-weight:900; color:#1e293b; text-transform:uppercase; letter-spacing:0.03em;">${ci.name}</div>
      ${ci.address ? `<div style="font-size:11px; color:#555; margin-top:2px;">${ci.address}</div>` : ''}
      ${ci.phone ? `<div style="font-size:11px; color:#555;">${ci.phone}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:32px; font-weight:900; color:#7c3aed; letter-spacing:0.1em; line-height:1;">TEKLİF</div>
      <div style="font-size:14px; font-weight:700; font-family:monospace; color:#1e293b; margin-top:4px;">${q.quote_number}</div>
      <div style="font-size:12px; color:#555; margin-top:4px;">Tarih: ${dateStr}</div>
      <div style="font-size:12px; font-weight:700; color:${q.valid_until && new Date(q.valid_until) < new Date() ? '#dc2626' : '#059669'}; margin-top:2px;">Geçerlilik: ${validStr}</div>
    </div>
  </div>

  <!-- MÜŞTERİ -->
  <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:4mm 6mm; margin-bottom:6mm; position:relative; z-index:1;">
    <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#7c3aed; margin-bottom:4px;">Teklif Verilen Firma</div>
    <div style="font-size:16px; font-weight:900; color:#1e293b;">${q.customer_name || '—'}</div>
  </div>

  <!-- ÜRÜN TABLOSU -->
  <div style="position:relative; z-index:1; margin-bottom:6mm;">
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:center; width:5%;">#</th>
          <th style="text-align:left; width:38%;">Ürün / Hizmet</th>
          <th style="text-align:center; width:8%;">Miktar</th>
          <th style="text-align:right; width:14%;">Birim Fiyat</th>
          <th style="text-align:center; width:8%;">İsk.%</th>
          <th style="text-align:center; width:8%;">KDV%</th>
          <th style="text-align:right; width:14%;">Tutar (TL)</th>
        </tr>
      </thead>
      <tbody style="border:1px solid #e2e8f0;">${itemsHtml}</tbody>
    </table>
  </div>

  <!-- TOPLAMLAR -->
  <div class="totals-block" style="position:relative; z-index:1; display:flex; justify-content:flex-end; margin-bottom:6mm;">
    <div style="width:45%; border-top:2px solid #7c3aed; padding-top:4mm;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; margin-bottom:4px;">
        <span>Ara Toplam (KDV Hariç)</span><span style="font-weight:600;">${net.toFixed(2)} TL</span>
      </div>
      ${vatRows}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5mm; padding-top:3mm; border-top:1px solid #ddd6fe;">
        <span style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:#7c3aed;">GENEL TOPLAM</span>
        <span style="font-size:24px; font-weight:900; color:#7c3aed;">${grand.toFixed(2)} TL</span>
      </div>
    </div>
  </div>

  ${q.notes ? `
  <!-- NOTLAR -->
  <div class="totals-block" style="position:relative; z-index:1; border-top:1px solid #e2e8f0; padding-top:3mm;">
    <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#92400e; margin-bottom:4px;">Notlar / Koşullar</div>
    <div style="font-size:12px; color:#555; white-space:pre-wrap;">${q.notes}</div>
  </div>` : ''}

</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 800); }</script>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=900,height=1200');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const handleConvertToSale = async (quote) => {
        if (!window.confirm(`"${quote.customer_name}" firmasına ₺${(quote.total || 0).toFixed(2)} tutarındaki teklif Açık Hesap olarak satışa çevrilecek. Onaylıyor musunuz?`)) return;
        setQuoteConverting(true);
        try {
            const saleCode = `SLS-${Date.now().toString().slice(-8)}`;
            await salesAPI.complete({
                sale_code: saleCode,
                items: quote.items,
                total: quote.total,
                payment_method: 'Açık Hesap',
                customer_id: quote.customer_id || null,
                customer_name: quote.customer_name
            });
            await priceQuotesAPI.update(quote.id, { status: 'Satışa Çevrildi', converted_sale_code: saleCode });
            setSelectedQuote(prev => ({ ...prev, status: 'Satışa Çevrildi', converted_sale_code: saleCode }));
            setShowViewQuoteModal(false);
            loadQuotes();
            loadSales();
            alert('Teklif başarıyla satışa çevrildi! Satış No: ' + saleCode);
        } catch (e) { alert('Hata: ' + e.message); }
        finally { setQuoteConverting(false); }
    };
    // ─────────────────────────────────────────────────────────────────────────

    const handleSaveSale = async () => {
        if (!window.confirm('Değişiklikleri kaydetmek istiyor musunuz?')) return;
        try {
            await salesAPI.update(editForm.sale_code, {
                items: editForm.items, // Backend expects 'items' or 'products' mapped
                total: totals.grand,
                payment_method: editForm.payment_method,
                customer_name: editForm.customer_name // Simple string update if name changed
            });
            alert('Satış güncellendi.');
            setIsDetailModalOpen(false);
            loadSales();
        } catch (error) {
            alert('Güncelleme hatası: ' + error.message);
        }
    };

    const printReceipt = (saleData) => {
        const paperSize = localStorage.getItem('receipt_paper_size') || 'Termal 80mm';

        // Check for Custom A5 HTML Design (Flag or Config Type)
        // Custom A5 HTML Design varsayılan olarak aktif
        // Sadece açıkça başka bir template seçildiyse devre dışı kalır
        const templateType = localStorage.getItem('receipt_template_type');
        let useCustomA5 = templateType === 'custom_html_a5' || !templateType;

        if (useCustomA5) {
            printCustomA5Receipt(saleData, paperSize);
            return;
        }

        // Fallback to generic receipt
        printA5Receipt(saleData, paperSize);
    };

    // Custom A5 HTML Receipt
    const printCustomA5Receipt = (saleData, paperSize) => {
        const savedConfig = localStorage.getItem('receipt_design_config');
        let companyInfo = {
            name: 'Firma Adı',
            address: '',
            phone: '',
            logo_text: 'K',
            showWatermark: true
        };

        if (savedConfig) {
            try {
                companyInfo = { ...companyInfo, ...JSON.parse(savedConfig) };
            } catch (e) {
                console.error("Error loading receipt config", e);
            }
        }

        const dateObj = saleData.created_at ? new Date(saleData.created_at) : new Date();
        const dateStr = dateObj.toLocaleDateString('tr-TR');
        const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const previousBalance = saleData.customerData?.balance || 0;
        const newBalance = previousBalance + (saleData.total || 0);

        // Generate Rows
        const itemsHtml = (saleData.items || []).map(item => {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const lineTotal = price * qty * (1 - discount / 100);

            // Check for image_url
            // Note: SalesPage items might have different structure, check if image_url exists
            const imageHtml = item.image_url
                ? `<img src="${item.image_url}" class="w-8 h-8 object-cover rounded bg-white border border-slate-200" style="object-fit: cover;" />`
                : `<div class="w-8 h-8 bg-slate-200 rounded flex items-center justify-center text-slate-400"><span class="material-symbols-outlined text-[16px]">image</span></div>`;


            return `
            <tr>
                <td class="font-medium text-slate-800">
                    <div class="flex items-center gap-2 min-w-0">
                        ${imageHtml}
                        <span class="truncate block">${item.name.substring(0, 36)}</span>
                    </div>
                </td>
                <td class="text-center text-slate-600">${qty} Ad.</td>
                <td class="text-right text-slate-600">${price.toFixed(2)} TL</td>
                <td class="text-right font-bold text-slate-800">${lineTotal.toFixed(2)} TL</td>
            </tr>
        `;
        }).join('');

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

    const printA5Receipt = (saleData, paperSize) => {
        const isA4 = paperSize === 'A4 (210x297mm)';
        const companyName = localStorage.getItem('receipt_company_name') || 'FIRMA ADI';
        const companyAddress = localStorage.getItem('receipt_company_address') || 'Adres Bilgisi';
        const companyPhone = localStorage.getItem('receipt_company_phone') || 'Tel: 0XXX XXX XX XX';

        const dateObj = saleData.created_at ? new Date(saleData.created_at) : new Date();

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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif;
            font-size: ${isA4 ? '11px' : '10px'}; color: #333;
        }
        .receipt-container { width: 100%; padding: 0; }
        .receipt-header { text-align: center; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 8px; }
        .receipt-header h1 { font-size: ${isA4 ? '18px' : '14px'}; font-weight: bold; margin-bottom: 2px; }
        .info-line { display: table; width: 100%; margin-bottom: 6px; border-bottom: 1px solid #ddd; }
        .info-line .left { display: table-cell; text-align: left; width: 50%; }
        .info-line .right { display: table-cell; text-align: right; width: 50%; font-weight: bold; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        table.items th { border-bottom: 1px solid #333; padding: 4px 2px; text-align: left; }
        table.items td { padding: 3px 2px; vertical-align: top; }
        .total-section { margin-top: 15px; text-align: center; font-weight: bold; font-size: 14px; }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="receipt-header">
            <h1>${companyName}</h1>
            <div>${companyAddress}<br>${companyPhone}</div>
        </div>
        <div class="info-line">
            <span class="left">${dateObj.toLocaleDateString('tr-TR')} ${dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="right">${saleData.customer || 'Müşteri'}</span>
        </div>
        <table class="items">
            <thead>
                <tr>
                    <th>URUN</th>
                    <th>ADET</th>
                    <th>FIYAT</th>
                    <th>TUTAR</th>
                </tr>
            </thead>
            <tbody>
                ${(saleData.items || []).map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="total-section">
            TOPLAM: ${(saleData.total || 0).toFixed(2)} TL
        </div>
    </div>
    <script>
        setTimeout(() => { window.print(); window.close(); }, 500);
    </script>
</body>
</html>`;

        const printWindow = window.open('', '_blank', `width=${isA4 ? 800 : 600},height=${isA4 ? 1000 : 800}`);
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
        }
    };

    const handleDeleteSale = async () => {
        if (!window.confirm('Bu satışı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
        try {
            await salesAPI.delete(editForm.sale_code);
            alert('Satış silindi.');
            setIsDetailModalOpen(false);
            loadSales();
        } catch (error) {
            alert('Silme hatası: ' + error.message);
        }
    };

    // Filter Logic
    const filteredSales = useMemo(() => {
        // Normalize purchase invoices into sale-like objects
        const normalizedPI = purchaseInvoices.map(inv => {
            let pd = null;
            try { pd = JSON.parse(inv.description); } catch { /* ignore */ }
            const isManuel = pd?.source === 'manuel';
            return {
                _isPurchaseInvoice: true,
                _piSource: isManuel ? 'manuel' : 'entegrasyon',
                id: inv.id,
                customer_id: inv.customer_id,
                date: inv.created_at,
                sale_code: pd?.invoiceDetails?.serialNo || `FAT-${inv.id.slice(0, 8)}`,
                customerName: inv.customers?.name || pd?.supplier?.name || '-',
                customer: inv.customers?.name || pd?.supplier?.name || '-',
                payment_method: 'Fatura (Alış)',
                items: (pd?.items || []).map(it => ({ ...it, stock_code: it.stockCode })),
                total: inv.amount,
                is_deleted: false,
                _rawData: inv,
            };
        });

        // Separate regular sales vs returns
        const regularSales = sales.filter(s => !(s.sale_code?.startsWith('RET') || s.payment_method === 'İade'));
        const returnSales = sales.filter(s => s.sale_code?.startsWith('RET') || s.payment_method === 'İade');

        let combined = [];
        if (showSales) combined = [...combined, ...regularSales];
        if (showReturns) combined = [...combined, ...returnSales];
        if (showPurchaseInvoices) combined = [...combined, ...normalizedPI];

        // Perakende filter
        const retailDefaults = ['toptan satış', 'misafir', 'misafir müşteri', '-', ''];
        if (onlyRetail) {
            combined = combined.filter(item => {
                if (item._isPurchaseInvoice) return false;
                const cName = (item.customerName || item.customer || '').toLowerCase().trim();
                return cName.startsWith('perakende-') || retailDefaults.includes(cName);
            });
        }

        // Apply text/price/item filters
        return combined.filter(item => {
            const term = filters.searchTerm.toLowerCase();
            const matchesGeneral = !term ||
                item.sale_code?.toLowerCase().includes(term) ||
                item.customerName?.toLowerCase().includes(term) ||
                item.customer?.toLowerCase().includes(term);
            if (!matchesGeneral) return false;

            const total = item.total || 0;
            if (filters.minPrice && total < parseFloat(filters.minPrice)) return false;
            if (filters.maxPrice && total > parseFloat(filters.maxPrice)) return false;

            const hasItemFilters = filters.stockCode || filters.productName || filters.barcode;
            if (hasItemFilters) {
                const saleItems = item.items || [];
                if (saleItems.length === 0) return false;
                const matchesItemCriteria = saleItems.some(i => {
                    let match = true;
                    if (filters.stockCode && !i.stock_code?.toLowerCase().includes(filters.stockCode.toLowerCase())) match = false;
                    if (filters.productName && !i.name?.toLowerCase().includes(filters.productName.toLowerCase())) match = false;
                    if (filters.barcode && !i.barcode?.toLowerCase().includes(filters.barcode.toLowerCase())) match = false;
                    return match;
                });
                if (!matchesItemCriteria) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [sales, purchaseInvoices, filters, showSales, showReturns, showPurchaseInvoices, onlyRetail]);

    const totalRevenue = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0), [filteredSales]);

    // Calculate Return Status Map
    const returnStatusMap = useMemo(() => {
        const map = {}; // Stores status for Original Sale Code
        const returnToOriginalMap = {}; // Maps ReturnCode -> OriginalCode

        // 1. Identify Return Transactions
        const returns = sales.filter(s => s.sale_code?.startsWith('RET') || s.payment_method === 'İade');

        // 2. Group returns by original sale code and build links
        returns.forEach(ret => {
            if (!ret.items) return;
            // Strategy A: Check items for 'return_from_sale_code' 
            // Strategy B: Parse from Sale Code (RET-SLS-xxx)
            let originalCode = ret.items.find(i => i.return_from_sale_code)?.return_from_sale_code;

            if (!originalCode && ret.sale_code) {
                const match = ret.sale_code.match(/(SLS-\d+)/);
                if (match) originalCode = match[0];
            }

            if (originalCode) {
                returnToOriginalMap[ret.sale_code] = originalCode;

                if (!map[originalCode]) {
                    map[originalCode] = { returnedQty: 0, saleCode: originalCode };
                }
                // Sum up quantities for the original sale
                ret.items.forEach(item => {
                    if (item.return_from_sale_code === originalCode) {
                        map[originalCode].returnedQty += (parseFloat(item.quantity) || 0);
                    } else if (!item.return_from_sale_code && originalCode) {
                        // Fallback logic
                        map[originalCode].returnedQty += (parseFloat(item.quantity) || 0);
                    }
                });
            }
        });

        // 3. Determine status (Partial vs Full) for Original Sales
        Object.keys(map).forEach(originalSaleCode => {
            const originalSale = sales.find(s => s.sale_code === originalSaleCode);
            if (originalSale && originalSale.items) {
                const totalSoldQty = originalSale.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
                const returned = map[originalSaleCode].returnedQty;

                if (returned >= totalSoldQty && totalSoldQty > 0) {
                    map[originalSaleCode].status = 'FULL';
                } else if (returned > 0) {
                    map[originalSaleCode].status = 'PARTIAL';
                }
            } else {
                // If original sale not found in list (e.g. different date), we can't be sure of 'Full', default to Partial or denote unknown
                // For safety and user visibility, let's mark as PARTIAL if we have evidence of return
                map[originalSaleCode].status = 'PARTIAL';
            }
        });

        // 4. Propagate status to Return Transactions
        // So that if we render a Return Row, it shows the status of the "deal"
        Object.keys(returnToOriginalMap).forEach(retCode => {
            const origCode = returnToOriginalMap[retCode];
            if (map[origCode]?.status) {
                map[retCode] = { status: map[origCode].status };
            }
        });

        return map;
    }, [sales]);

    return (
        <>
        <div className="min-h-screen flex flex-row bg-slate-50 font-display relative">
            {loading && (
                <div className="absolute inset-0 z-[100] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-fashion transition-all duration-500">
                    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center animate-fade-in-up">
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl animate-pulse-glow"></div>
                            <div className="relative w-24 h-24 flex items-center justify-center border border-slate-100 dark:border-slate-800 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm">
                                <span className="material-symbols-outlined text-4xl text-blue-600 font-extralight scale-125">
                                    point_of_sale
                                </span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-light tracking-[0.3em] uppercase mb-4 text-center leading-relaxed text-slate-900 dark:text-slate-100">
                            Satışlar <br />
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
            {/* Fixed Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 fixed top-0 bottom-0 left-0 overflow-y-auto z-30 shadow-xl shadow-slate-200/50">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">filter_alt</span>
                        Filtreleme
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Satış geçmişini detaylı sorgula</p>
                </div>

                <div className="p-5 space-y-5">
                    {/* Date Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tarih Aralığı</label>
                        <div className="space-y-2">
                            <input
                                type="date"
                                name="start"
                                value={dateRange.start}
                                onChange={handleDateChange}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <input
                                type="date"
                                name="end"
                                value={dateRange.end}
                                onChange={handleDateChange}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={loadSales}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">sync</span>
                            Uygula & Yenile
                        </button>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* General Search */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Genel Arama</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                name="searchTerm"
                                value={filters.searchTerm}
                                onChange={handleFilterChange}
                                placeholder="Satış No, Müşteri..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ürün Detayları</label>
                        <input
                            type="text"
                            name="productName"
                            value={filters.productName}
                            onChange={handleFilterChange}
                            placeholder="Ürün Adı"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="text"
                            name="stockCode"
                            value={filters.stockCode}
                            onChange={handleFilterChange}
                            placeholder="Stok Kodu"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input
                            type="text"
                            name="barcode"
                            value={filters.barcode}
                            onChange={handleFilterChange}
                            placeholder="Barkod"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Price Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fiyat Aralığı (TL)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                name="minPrice"
                                value={filters.minPrice}
                                onChange={handleFilterChange}
                                placeholder="Min"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="number"
                                name="maxPrice"
                                value={filters.maxPrice}
                                onChange={handleFilterChange}
                                placeholder="Max"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Show Deleted Sales */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={showDeleted}
                                    onChange={(e) => setShowDeleted(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-red-500 transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Silinen Satışları Göster</span>
                                <p className="text-xs text-slate-400">İptal edilen satışları da listele</p>
                            </div>
                        </label>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Transaction Type Filters */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">İşlem Türleri</label>

                        {/* Satışları Göster */}
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0">
                                <input type="checkbox" checked={showSales} onChange={(e) => setShowSales(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Satışları Göster</span>
                                <p className="text-xs text-slate-400">Nakit, Kredi Kartı, Açık Hesap</p>
                            </div>
                        </label>

                        {/* İadeleri Göster */}
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0">
                                <input type="checkbox" checked={showReturns} onChange={(e) => setShowReturns(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-orange-500 transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">İadeleri Göster</span>
                                <p className="text-xs text-slate-400">Tüm iade işlemleri</p>
                            </div>
                        </label>

                        {/* Alış Faturaları Göster */}
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0">
                                <input type="checkbox" checked={showPurchaseInvoices} onChange={(e) => setShowPurchaseInvoices(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-indigo-500 transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Alış Faturalarını Göster</span>
                                <p className="text-xs text-slate-400">Manuel alış faturaları</p>
                            </div>
                        </label>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Perakende Filter */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0">
                                <input type="checkbox" checked={onlyRetail} onChange={(e) => setOnlyRetail(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-violet-500 transition-colors"></div>
                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Sadece Perakende Satışları</span>
                                <p className="text-xs text-slate-400">Bakiyede kayıtsız müşterileri listele</p>
                            </div>
                        </label>
                    </div>
                </div>
            </aside>

            {/* Main Content - Pushed right by sidebar width */}
            <main className="flex-1 ml-80 flex flex-col min-h-screen">
                <header className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm/50 backdrop-blur-sm bg-white/90">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Satışlar</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {showTotalSales ? (
                                <><span className="font-bold text-slate-900">{filteredSales.length}</span> işlem bulundu</>
                            ) : (
                                <span className="text-slate-400">*** işlem</span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={openQuotesModal}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-violet-500/30 transition-all hover:-translate-y-0.5 text-sm"
                    >
                        <span className="material-symbols-outlined text-base">request_quote</span>
                        Fiyat Teklifleri
                    </button>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">TOPLAM CİRO</p>
                        {showTotalRevenue ? (
                            <p className="text-2xl font-extrabold text-emerald-600">₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                        ) : (
                            <p className="text-2xl font-extrabold text-slate-300">*******</p>
                        )}
                    </div>
                </header>

                <div className="p-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {filteredSales.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">receipt_long</span>
                                <p>Kayıtlı satış bulunamadı.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-2">Tarih</th>
                                        <th className="px-6 py-2">Satış No</th>
                                        <th className="px-6 py-2">Müşteri</th>
                                        <th className="px-6 py-2">Ödeme Tipi</th>
                                        <th className="px-6 py-2">Ürünler</th>
                                        <th className="px-6 py-2 text-right">Tutar</th>
                                        <th className="px-6 py-2 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                {/* Using map inside tbody or fragment */}
                                {filteredSales.map((sale) => {
                                    const status = returnStatusMap[sale.sale_code]?.status;
                                    const isPI = sale._isPurchaseInvoice;

                                    // Purchase Invoice row
                                    if (isPI) {
                                        const isManuelPI = sale._piSource === 'manuel';
                                        return (
                                            <tbody key={`pi-${sale.id}`} className={`group transition-colors border-b border-slate-100 last:border-0 ${isManuelPI ? 'hover:bg-indigo-50/30 bg-indigo-50/10' : 'hover:bg-purple-50/30 bg-purple-50/10'}`}>
                                                <tr>
                                                    <td className="px-6 py-2 text-sm text-slate-600 whitespace-nowrap">
                                                        {new Date(sale.date).toLocaleString('tr-TR')}
                                                    </td>
                                                    <td className="px-6 py-2 font-medium text-slate-900 font-mono whitespace-nowrap text-sm">
                                                        {sale.sale_code}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-600">
                                                        {sale.customerName || sale.customer || '-'}
                                                    </td>
                                                    <td className="px-6 py-2">
                                                        {isManuelPI ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                                Alış (Manuel)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                                Alış (E-Fatura)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-500 max-w-xs truncate">
                                                        {sale.items && sale.items.length > 0
                                                            ? sale.items.map(i => `${i.name} x${i.quantity}`).join(', ')
                                                            : '-'}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm font-bold text-indigo-700 text-right whitespace-nowrap">
                                                        ₺{sale.total?.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-2 text-center">
                                                        <button
                                                            onClick={() => setSelectedPurchaseInvoice(sale._rawData)}
                                                            className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors"
                                                        >
                                                            Detay
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        );
                                    }

                                    return (
                                        <tbody key={sale.id} className={`group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${!sale.is_deleted && (sale.customerName || sale.customer || '').startsWith('Perakende-') ? 'bg-gray-100' : ''}`}>
                                            <tr className={`${sale.is_deleted ? 'bg-red-50/70 opacity-60' : ''}`}>
                                                <td className="px-6 py-2 text-sm text-slate-600 whitespace-nowrap">
                                                    {new Date(sale.date).toLocaleString('tr-TR')}
                                                </td>
                                                <td className="px-6 py-2 font-medium text-slate-900 font-mono whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className={status ? 'text-xs' : 'text-sm'}>{sale.sale_code}</span>
                                                        {sale.is_deleted && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 uppercase tracking-wider">Silindi</span>
                                                        )}
                                                        {status && (
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${status === 'FULL' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                {status === 'FULL' ? 'Tam İade' : 'Kısmi İade'}
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-2 text-sm text-slate-600">
                                                    {sale.customerName || sale.customer || '-'}
                                                </td>
                                                <td className="px-6 py-2">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sale.payment_method === 'Nakit' ? 'bg-emerald-100 text-emerald-800' :
                                                        (sale.payment_method === 'Kredi Kartı' || sale.payment_method === 'POS') ? 'bg-blue-100 text-blue-800' :
                                                        (sale.payment_method === 'İade') ? 'bg-orange-100 text-orange-800' :
                                                            'bg-slate-100 text-slate-800'
                                                        }`}>
                                                        {sale.payment_method === 'POS' ? 'Kredi Kartı' : sale.payment_method}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-2 text-sm text-slate-500 max-w-xs truncate">
                                                    {sale.items && sale.items.length > 0
                                                        ? sale.items.map(i => `${i.name} x${i.quantity}`).join(', ')
                                                        : '-'}
                                                </td>
                                                <td className="px-6 py-2 text-sm font-bold text-slate-900 text-right whitespace-nowrap">
                                                    ₺{sale.total?.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => openDetailModal(sale)}
                                                            className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                                                        >
                                                            Detay
                                                        </button>
                                                        {(() => {
                                                            const custName = sale.customerName || sale.customer || '';
                                                            const isToptan = custName === 'Toptan Satış' || custName === 'Misafir' || custName === 'Misafir Müşteri' || !custName || custName === '-';
                                                            const isReturn = sale.sale_code?.startsWith('RET') || sale.payment_method === 'İade';
                                                            const isDeleted = sale.is_deleted;
                                                            if (isToptan || isReturn || isDeleted) return null;
                                                            if (sale.birfatura_uuid) {
                                                                return (
                                                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                        Faturası Kesildi
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <button
                                                                    onClick={() => handleInvoiceForSale(sale)}
                                                                    disabled={invoiceLoadingSaleId === sale.id}
                                                                    className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                                                >
                                                                    {invoiceLoadingSaleId === sale.id ? (
                                                                        <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Kesiliyor</>
                                                                    ) : (
                                                                        <><span className="material-symbols-outlined text-sm">receipt_long</span> Fatura Kes</>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    );
                                })}
                            </table>
                        )}
                    </div>
                </div>
            </main >

            {/* DETAIL MODAL */}
            {
                isDetailModalOpen && editForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Satış Detayı</h3>
                                    <p className="text-sm text-slate-400 font-mono mt-0.5">{editForm.sale_code}</p>
                                </div>
                                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                {/* Top Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Müşteri</label>
                                        <input
                                            type="text"
                                            value={editForm.customer_name || editForm.customer || ''}
                                            onChange={(e) => handleEditChange('customer_name', e.target.value)}
                                            className="w-full font-bold text-slate-800 border-b border-slate-200 focus:border-blue-500 outline-none py-1 bg-transparent"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ödeme Tipi</label>
                                        <div className="font-bold text-slate-600 py-1">
                                            {editForm.payment_method === 'POS' ? 'KREDİ KARTI' : editForm.payment_method}
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tarih</label>
                                        <p className="font-bold text-slate-800 py-1">
                                            {new Date(editForm.date).toLocaleString('tr-TR')}
                                        </p>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Ürün</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-20">Adet</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center w-28">Birim Fiyat</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right w-28">Tutar</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center w-24">KDV Oranı</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-center w-28">KDV Dahil?</th>
                                                <th className="px-4 py-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {editForm.items.map((item, idx) => {
                                                const itemVatRate = parseFloat(item.vat_rate) || 0;
                                                const itemPrice = parseFloat(item.price) || 0;
                                                // Handle display price based on toggle
                                                // If Included: Show itemPrice (Gross)
                                                // If Excluded: Show itemPrice / (1+rate) (Net)
                                                const displayPrice = item.is_vat_inc
                                                    ? itemPrice
                                                    : (itemPrice / (1 + itemVatRate / 100));

                                                return (
                                                    <tr key={idx} className="group hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{item.stock_code}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                                className="w-16 text-center border rounded py-1 text-sm font-bold text-red-600 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                value={Number(displayPrice).toFixed(2)}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    let newGrossPrice = val;
                                                                    if (!item.is_vat_inc) {
                                                                        // User entered Net, convert to Gross for storage
                                                                        newGrossPrice = val * (1 + itemVatRate / 100);
                                                                    }
                                                                    handleItemChange(idx, 'price', newGrossPrice);
                                                                }}
                                                                className="w-24 text-center border rounded py-1 text-sm font-bold text-red-600 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-red-600">
                                                            {(item.quantity * item.price * (1 - (item.discount_rate || 0) / 100)).toFixed(2)} ₺
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                value={item.vat_rate}
                                                                onChange={(e) => handleItemChange(idx, 'vat_rate', e.target.value)}
                                                                className="w-16 text-center border rounded py-1 text-xs text-slate-500 font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleItemChange(idx, 'is_vat_inc', !item.is_vat_inc)}
                                                                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${item.is_vat_inc ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                                            >
                                                                {item.is_vat_inc ? 'EVET' : 'HAYIR'}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleDeleteItem(idx)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {editForm.items.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 text-sm">Ürün bulunamadı</div>
                                    )}
                                </div>

                                {/* Totals */}
                                {/* Totals with VAT Breakdown */}
                                <div className="flex justify-end gap-6 items-start">
                                    {/* VAT Breakdown */}
                                    <div className="text-right space-y-1.5 py-2">
                                        <div className="text-xs text-slate-400">
                                            Toplam KDV: <span className="font-bold text-slate-600">₺{totals.vat.toFixed(2)}</span>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            KDV'siz Toplam: <span className="font-bold text-slate-600">₺{totals.net.toFixed(2)}</span>
                                        </div>
                                        {Object.entries(totals.breakdown).map(([rate, amount]) => (
                                            amount > 0 && (
                                                <div key={rate} className="text-[10px] text-slate-400">
                                                    %{rate} KDV: <span className="text-slate-500">₺{amount.toFixed(2)}</span>
                                                </div>
                                            )
                                        ))}
                                    </div>

                                    {/* Grand Total Box */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-72">
                                        <div className="flex justify-between items-center">
                                            <span className="text-base font-bold text-slate-800">GENEL TOPLAM</span>
                                            <span className="text-2xl font-black text-emerald-600">₺{totals.grand.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDeleteSale}
                                        className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-bold transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">delete_forever</span>
                                        Satışı Sil
                                    </button>
                                    <button
                                        onClick={openProductModal}
                                        className="px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl font-bold transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">add_shopping_cart</span>
                                        Yeni Ürün Ekle
                                    </button>
                                    <button
                                        onClick={() => printReceipt(selectedSale)}
                                        className="px-4 py-2.5 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700 rounded-xl font-bold transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">print</span>
                                        Fiş Yazdır
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsDetailModalOpen(false)}
                                        className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 font-bold rounded-xl transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleSaveSale}
                                        className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30 rounded-xl font-bold transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">save</span>
                                        Kaydet
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* PRODUCT SEARCH MODAL */}
            {
                isProductModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">Ürün Ara & Ekle</h3>
                                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* Search Input */}
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        type="text"
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        placeholder="Ürün adı, barkod veya stok kodu..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        autoFocus
                                    />
                                </div>

                                {/* Product List */}
                                <div className="h-64 overflow-y-auto border border-slate-100 rounded-xl">
                                    {productModalLoading ? (
                                        <div className="flex justify-center items-center h-full">
                                            <div className="spinner"></div>
                                        </div>
                                    ) : filteredProductsForModal.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <span className="material-symbols-outlined text-3xl mb-2">inventory_2</span>
                                            <p>Ürün bulunamadı</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredProductsForModal.map(product => (
                                                <div
                                                    key={product.stock_code}
                                                    onClick={() => setSelectedProductToAdd(product)}
                                                    className={`p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors ${selectedProductToAdd?.stock_code === product.stock_code ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}
                                                >
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                                            <span>{product.stock_code}</span>
                                                            {product.barcode && <span>• {product.barcode}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="font-bold text-slate-800">
                                                        ₺{parseFloat(product.price).toFixed(2)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Quantity & Action */}
                                <div className="flex items-end gap-4 pt-2">
                                    <div className="w-24">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Miktar</label>
                                        <input
                                            type="number"
                                            value={tempQty}
                                            onChange={(e) => setTempQty(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                            min="1"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddProductToSale}
                                        disabled={!selectedProductToAdd}
                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
                                    >
                                        Listeye Ekle
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* PURCHASE INVOICE DETAIL MODAL */}
            {selectedPurchaseInvoice && (() => {
                let invoiceData = null;
                try { invoiceData = JSON.parse(selectedPurchaseInvoice.description); } catch { /* ignore */ }

                const invItems = invoiceData?.items || [];
                const supplierInfo = invoiceData?.supplier || {};
                const invDetails = invoiceData?.invoiceDetails || {};

                const calcLineTotal = (item) => {
                    let p = (item.quantity || 0) * (item.price || 0);
                    if (item.disc1) p -= p * (item.disc1 / 100);
                    if (item.disc2) p -= p * (item.disc2 / 100);
                    if (item.disc3) p -= p * (item.disc3 / 100);
                    if (item.disc4) p -= p * (item.disc4 / 100);
                    return p + p * ((item.vatRate || 0) / 100);
                };

                const subTotal = invItems.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p;
                }, 0);
                const vatTotal = invItems.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p * ((it.vatRate || 0) / 100);
                }, 0);
                const grandTotal = invoiceData?.totals?.grandTotal || (subTotal + vatTotal);
                const fmtC = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
                const customerName = selectedPurchaseInvoice.customers?.name || supplierInfo.name || '-';

                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined">receipt_long</span>
                                        Alış Faturası Detayları
                                        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-medium">Salt Okunur</span>
                                    </h2>
                                    <p className="text-indigo-200 text-sm mt-0.5">
                                        {customerName} • {new Date(selectedPurchaseInvoice.created_at).toLocaleDateString('tr-TR')}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedPurchaseInvoice(null)} className="text-white/70 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {!invoiceData ? (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <p className="text-2xl font-bold text-slate-800">{fmtC(selectedPurchaseInvoice.amount)} TL</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-sm">business</span>
                                                    Tedarikçi Bilgileri
                                                </h3>
                                                <div className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between"><span className="text-slate-500">Firma:</span><span className="font-medium text-slate-800">{supplierInfo.name || '-'}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Vergi D.:</span><span className="font-medium text-slate-800">{supplierInfo.taxOffice || '-'}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Vergi No:</span><span className="font-medium text-slate-800">{supplierInfo.taxNo || '-'}</span></div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-sm">description</span>
                                                    Fatura Bilgileri
                                                </h3>
                                                <div className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between"><span className="text-slate-500">Seri No:</span><span className="font-medium text-slate-800">{invDetails.serialNo || '-'}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Tarih:</span><span className="font-medium text-slate-800">{invDetails.date ? new Date(invDetails.date).toLocaleDateString('tr-TR') : '-'}</span></div>
                                                    {invDetails.dueDate && <div className="flex justify-between"><span className="text-slate-500">Vade:</span><span className="font-medium text-slate-800">{new Date(invDetails.dueDate).toLocaleDateString('tr-TR')}</span></div>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
                                                <h3 className="font-semibold flex items-center gap-2 text-slate-900 text-sm">
                                                    <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                                                    Ürün Kalemleri ({invItems.length})
                                                </h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                            <th className="px-2 py-2 border-b border-slate-200 w-8 text-center">#</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 w-24">Stok Kodu</th>
                                                            <th className="px-2 py-2 border-b border-slate-200">Ürün Adı</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">Miktar</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-20">B. Fiyat</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">KDV%</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-24">Toplam</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {invItems.map((item, index) => (
                                                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-2 py-2 text-xs text-slate-400 text-center">{index + 1}</td>
                                                                <td className="px-2 py-2 text-xs font-mono font-medium text-slate-600">{item.stockCode || '-'}</td>
                                                                <td className="px-2 py-2 text-xs font-semibold text-slate-900">{item.name || '-'}</td>
                                                                <td className="px-2 py-2 text-xs text-center font-medium text-slate-800">{item.quantity}</td>
                                                                <td className="px-2 py-2 text-xs text-right font-medium text-slate-800">{fmtC(item.price)}</td>
                                                                <td className="px-2 py-2 text-xs text-center text-slate-600">%{item.vatRate || 0}</td>
                                                                <td className="px-2 py-2 text-xs text-right font-bold text-slate-700">{fmtC(calcLineTotal(item))} TL</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                {invoiceData.note && (
                                                    <>
                                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fatura Notu</label>
                                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">{invoiceData.note}</div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Ara Toplam</span>
                                                    <span className="font-semibold text-slate-900">{fmtC(subTotal)} TL</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">KDV Toplamı</span>
                                                    <span className="font-semibold text-slate-900">{fmtC(vatTotal)} TL</span>
                                                </div>
                                                <div className="pt-2 border-t border-slate-300">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Genel Toplam</span>
                                                        <span className="text-xl font-extrabold text-slate-900">{fmtC(grandTotal)} TL</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end flex-shrink-0">
                                <button
                                    onClick={() => setSelectedPurchaseInvoice(null)}
                                    className="px-6 py-2.5 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div >

        {/* ══════════════════ FIYAT TEKLİFLERİ MODALLARI ══════════════════ */}

        {/* 1. Teklif Listesi */}
        {showQuotesModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-700 to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-white text-2xl">request_quote</span>
                            <div>
                                <h2 className="text-white font-black text-xl">Fiyat Teklifleri</h2>
                                <p className="text-violet-200 text-xs">{quotes.length} teklif kayıtlı</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setShowNewQuoteModal(true); openNewQuoteModal(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-sm transition-all border border-white/30"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Yeni Fiyat Teklifi
                            </button>
                            <button onClick={() => setShowQuotesModal(false)} className="text-white/70 hover:text-white transition-colors">
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 relative">
                        {quotesLoading ? (
                            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10">
                                <div className="relative w-full max-w-xs flex flex-col items-center justify-center">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-violet-600/20 rounded-full blur-2xl animate-pulse"></div>
                                        <div className="relative w-20 h-20 flex items-center justify-center border border-violet-100 rounded-full bg-white/80 shadow-sm">
                                            <span className="material-symbols-outlined text-4xl text-violet-600" style={{fontVariationSettings:"'FILL' 0,'wght' 300"}}>request_quote</span>
                                        </div>
                                    </div>
                                    <h2 className="text-xl font-light tracking-[0.25em] uppercase mb-3 text-center text-slate-800">
                                        Fiyat Teklifleri<br /><span className="font-semibold text-violet-600">Yükleniyor</span>
                                    </h2>
                                    <div className="w-48 mt-4">
                                        <div className="relative h-[2px] w-full bg-violet-100 rounded-full overflow-hidden">
                                            <div className="absolute top-0 h-full bg-violet-600 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" style={{animation:'progress 1.5s ease-in-out infinite'}}></div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-400 mt-3 tracking-wider">Lütfen bekleyiniz...</p>
                                </div>
                            </div>
                        ) : quotes.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">request_quote</span>
                                <p className="font-medium">Henüz fiyat teklifi oluşturulmamış.</p>
                                <p className="text-sm mt-1">Yukarıdaki butona tıklayarak yeni teklif oluşturun.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-2 text-left">Teklif No</th>
                                        <th className="px-4 py-2 text-left">Müşteri</th>
                                        <th className="px-4 py-2 text-left">Tarih</th>
                                        <th className="px-4 py-2 text-left">Geçerlilik</th>
                                        <th className="px-4 py-2 text-right">Tutar</th>
                                        <th className="px-4 py-2 text-center">Durum</th>
                                        <th className="px-4 py-2 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {quotes.map(q => {
                                        const statusColor = {
                                            'Beklemede': 'bg-amber-100 text-amber-700',
                                            'Onaylandı': 'bg-green-100 text-green-700',
                                            'Reddedildi': 'bg-red-100 text-red-700',
                                            'Satışa Çevrildi': 'bg-blue-100 text-blue-700'
                                        }[q.status] || 'bg-slate-100 text-slate-600';
                                        const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === 'Beklemede';
                                        return (
                                            <tr key={q.id} className={`hover:bg-violet-50/50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-3 font-mono font-bold text-violet-700">{q.quote_number}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-800">{q.customer_name || '—'}</td>
                                                <td className="px-4 py-3 text-slate-500">{q.created_at ? new Date(q.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-medium ${isExpired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                        {q.valid_until ? new Date(q.valid_until).toLocaleDateString('tr-TR') : '—'}
                                                        {isExpired && ' (Süresi Doldu)'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">₺{(q.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor}`}>{q.status}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => { setSelectedQuote(q); setShowViewQuoteModal(true); }}
                                                            className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"
                                                        >Görüntüle</button>
                                                        {q.status !== 'Satışa Çevrildi' && (
                                                            <button
                                                                onClick={() => handleDeleteQuote(q.id)}
                                                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors"
                                                            ><span className="material-symbols-outlined text-base">delete</span></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* 2. Yeni Teklif Formu */}
        {showNewQuoteModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-700 to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-white text-xl">{editingQuoteId ? 'edit' : 'add_circle'}</span>
                            <h2 className="text-white font-black text-lg">{editingQuoteId ? 'Teklifi Düzenle' : 'Yeni Fiyat Teklifi'}</h2>
                        </div>
                        <button onClick={() => { setShowNewQuoteModal(false); setEditingQuoteId(null); }} className="text-white/70 hover:text-white">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {/* Müşteri & Tarih */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Müşteri Adı *</label>
                                <input
                                    type="text"
                                    list="quote-customers-list"
                                    value={quoteForm.customer_name}
                                    onChange={e => {
                                        const name = e.target.value;
                                        const found = allCustomers.find(c => c.name === name);
                                        setQuoteForm(prev => ({ ...prev, customer_name: name, customer_id: found?.id || '' }));
                                    }}
                                    placeholder="Müşteri adı yazın veya seçin..."
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none"
                                />
                                <datalist id="quote-customers-list">
                                    {allCustomers.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Geçerlilik Tarihi</label>
                                <input
                                    type="date"
                                    value={quoteForm.valid_until}
                                    onChange={e => setQuoteForm(prev => ({ ...prev, valid_until: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>

                        {/* Ürün Arama */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ürün Ekle</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                <input
                                    type="text"
                                    value={quoteProductSearch}
                                    onChange={e => setQuoteProductSearch(e.target.value)}
                                    placeholder="Ürün adı veya stok kodu ile arayın..."
                                    className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none"
                                />
                            </div>
                            {quoteProductSearch.length > 1 && (
                                <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-10 relative">
                                    {allProducts
                                        .filter(p => p.name?.toLowerCase().includes(quoteProductSearch.toLowerCase()) || p.stock_code?.toLowerCase().includes(quoteProductSearch.toLowerCase()))
                                        .slice(0, 12)
                                        .map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => addProductToQuote(p)}
                                                className="w-full text-left px-4 py-2 hover:bg-violet-50 text-sm flex justify-between items-center border-b border-slate-50 last:border-0"
                                            >
                                                <span className="font-medium text-slate-800">{p.name}</span>
                                                <span className="text-xs text-slate-500 ml-2 flex-shrink-0">₺{(p.price || 0).toFixed(2)} · {p.stock_code}</span>
                                            </button>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* Ürün Listesi */}
                        {quoteForm.items.length > 0 && (
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Ürün</th>
                                            <th className="px-3 py-2 text-center w-20">Miktar</th>
                                            <th className="px-3 py-2 text-center w-28">Birim Fiyat</th>
                                            <th className="px-3 py-2 text-center w-16">İsk.%</th>
                                            <th className="px-3 py-2 text-center w-16">KDV%</th>
                                            <th className="px-3 py-2 text-right w-28">Tutar</th>
                                            <th className="px-3 py-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {quoteForm.items.map((item, idx) => {
                                            const qty = parseFloat(item.quantity) || 0;
                                            const pr = parseFloat(item.price) || 0;
                                            const disc = parseFloat(item.discount_rate) || 0;
                                            const rate = parseFloat(item.vat_rate) || 0;
                                            const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
                                            const lineTotal = pr * qty * (1 - disc / 100);
                                            return (
                                                <tr key={idx} className="hover:bg-violet-50/30">
                                                    <td className="px-3 py-1.5 font-medium text-slate-800">{item.name}</td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <input type="number" min="0.01" step="0.01" value={item.quantity}
                                                            onChange={e => updateQuoteItem(idx, 'quantity', e.target.value)}
                                                            className="w-16 text-center border border-slate-200 rounded-lg px-1 py-0.5 text-sm focus:ring-1 focus:ring-violet-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <input type="number" min="0" step="0.01" value={item.price}
                                                            onChange={e => updateQuoteItem(idx, 'price', e.target.value)}
                                                            className="w-24 text-center border border-slate-200 rounded-lg px-1 py-0.5 text-sm focus:ring-1 focus:ring-violet-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <input type="number" min="0" max="100" value={item.discount_rate || 0}
                                                            onChange={e => updateQuoteItem(idx, 'discount_rate', e.target.value)}
                                                            className="w-14 text-center border border-slate-200 rounded-lg px-1 py-0.5 text-sm focus:ring-1 focus:ring-violet-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <input type="number" min="0" max="100" value={item.vat_rate}
                                                            onChange={e => updateQuoteItem(idx, 'vat_rate', e.target.value)}
                                                            className="w-14 text-center border border-slate-200 rounded-lg px-1 py-0.5 text-sm focus:ring-1 focus:ring-violet-400 outline-none" />
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-bold text-slate-900">₺{lineTotal.toFixed(2)}</td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <button onClick={() => removeQuoteItem(idx)} className="text-red-400 hover:text-red-600">
                                                            <span className="material-symbols-outlined text-base">remove_circle</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Notlar */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Notlar / Açıklamalar</label>
                            <textarea
                                rows={3}
                                value={quoteForm.notes}
                                onChange={e => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Teklif koşulları, teslimat süresi, ödeme vadesi vb."
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 outline-none resize-none"
                            />
                        </div>

                        {/* Toplam */}
                        {quoteForm.items.length > 0 && (
                            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 space-y-1.5">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Ara Toplam (KDV Hariç)</span>
                                    <span className="font-semibold">₺{quoteItemTotals.net.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>KDV Toplamı</span>
                                    <span className="font-semibold">₺{quoteItemTotals.vat.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1.5 border-t border-violet-300">
                                    <span className="font-black text-violet-800 uppercase tracking-wider text-sm">Genel Toplam</span>
                                    <span className="text-2xl font-black text-violet-800">₺{quoteItemTotals.grand.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                        <button onClick={() => { setShowNewQuoteModal(false); setEditingQuoteId(null); }} className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 text-sm transition-colors">İptal</button>
                        <button
                            onClick={handleSaveQuote}
                            disabled={quoteSaving}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black rounded-xl shadow-md transition-all text-sm flex items-center gap-2 disabled:opacity-60"
                        >
                            {quoteSaving
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Kaydediliyor...</>
                                : <><span className="material-symbols-outlined text-base">save</span>{editingQuoteId ? 'Güncelle' : 'Kaydet'}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 3. Teklif Görüntüle (Profesyonel) */}
        {showViewQuoteModal && selectedQuote && (() => {
            const q = selectedQuote;
            const companyInfoRaw = localStorage.getItem('receipt_design_config');
            const companyInfo = companyInfoRaw ? JSON.parse(companyInfoRaw) : {};
            const statusStyle = {
                'Beklemede': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
                'Onaylandı': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
                'Reddedildi': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
                'Satışa Çevrildi': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' }
            }[q.status] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
            const items = q.items || [];
            let net = 0, vat = 0;
            items.forEach(item => {
                const qty = parseFloat(item.quantity) || 0;
                const pr = parseFloat(item.price) || 0;
                const disc = parseFloat(item.discount_rate) || 0;
                const rate = parseFloat(item.vat_rate) || 0;
                const unitNet = item.is_vat_inc ? pr / (1 + rate / 100) : pr;
                const lineNet = unitNet * qty * (1 - disc / 100);
                net += lineNet;
                vat += lineNet * (rate / 100);
            });
            const grand = net + vat;
            const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === 'Beklemede';
            return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-2">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[98vh] flex flex-col overflow-hidden">
                        {/* Modal Header Bar */}
                        <div className="bg-gradient-to-r from-violet-700 to-purple-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-white">description</span>
                                <span className="text-white font-black">Teklif Detayı — {q.quote_number}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>{q.status}</span>
                                {isExpired && <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-bold">SÜRESİ DOLDU</span>}
                            </div>
                            <button onClick={() => setShowViewQuoteModal(false)} className="text-white/70 hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Teklif İçeriği */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Teklif Başlığı */}
                                <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 py-6 flex justify-between items-start">
                                    <div>
                                        <div className="text-white font-black text-2xl tracking-wide">{companyInfo.name || 'Firmamız'}</div>
                                        {companyInfo.address && <div className="text-slate-400 text-xs mt-1">{companyInfo.address}</div>}
                                        {companyInfo.phone && <div className="text-slate-400 text-xs">{companyInfo.phone}</div>}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-violet-400 font-black text-3xl tracking-widest">TEKLİF</div>
                                        <div className="text-white font-mono font-bold mt-1">{q.quote_number}</div>
                                        <div className="text-slate-400 text-xs mt-1">
                                            <span>Tarih: {q.created_at ? new Date(q.created_at).toLocaleDateString('tr-TR') : '—'}</span>
                                        </div>
                                        <div className={`text-xs mt-0.5 font-bold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                                            Geçerlilik: {q.valid_until ? new Date(q.valid_until).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}
                                        </div>
                                    </div>
                                </div>

                                {/* Müşteri Bilgisi */}
                                <div className="px-8 py-4 border-b border-slate-100 bg-violet-50/50">
                                    <div className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">Teklif Verilen Firma</div>
                                    <div className="text-xl font-black text-slate-800">{q.customer_name || '—'}</div>
                                </div>

                                {/* Ürün Tablosu */}
                                <div className="px-8 py-4">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b-2 border-slate-200 text-xs font-black uppercase tracking-wider text-slate-500">
                                                <th className="pb-2 text-left">#</th>
                                                <th className="pb-2 text-left">Ürün / Hizmet</th>
                                                <th className="pb-2 text-center">Miktar</th>
                                                <th className="pb-2 text-right">Birim Fiyat</th>
                                                <th className="pb-2 text-center">İsk.%</th>
                                                <th className="pb-2 text-center">KDV%</th>
                                                <th className="pb-2 text-right">Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item, idx) => {
                                                const qty = parseFloat(item.quantity) || 0;
                                                const pr = parseFloat(item.price) || 0;
                                                const disc = parseFloat(item.discount_rate) || 0;
                                                const lineTotal = pr * qty * (1 - disc / 100);
                                                return (
                                                    <tr key={idx} className="text-slate-700">
                                                        <td className="py-2 text-slate-400 font-bold text-xs">{idx + 1}</td>
                                                        <td className="py-2 font-semibold">{item.name}</td>
                                                        <td className="py-2 text-center">{qty}</td>
                                                        <td className="py-2 text-right font-mono">₺{pr.toFixed(2)}</td>
                                                        <td className="py-2 text-center text-slate-500">{disc > 0 ? `%${disc}` : '—'}</td>
                                                        <td className="py-2 text-center text-indigo-600 font-bold">%{item.vat_rate}</td>
                                                        <td className="py-2 text-right font-bold font-mono">₺{lineTotal.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Toplamlar */}
                                <div className="px-8 py-4 border-t border-slate-200 flex justify-end">
                                    <div className="w-64 space-y-1.5">
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Ara Toplam</span><span className="font-semibold">₺{net.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>KDV</span><span className="font-semibold">₺{vat.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t-2 border-violet-300">
                                            <span className="font-black text-violet-800 text-sm uppercase tracking-wider">Genel Toplam</span>
                                            <span className="text-2xl font-black text-violet-800">₺{grand.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Notlar */}
                                {q.notes && (
                                    <div className="px-8 py-4 border-t border-slate-100 bg-amber-50/50">
                                        <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">Notlar / Koşullar</div>
                                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{q.notes}</div>
                                    </div>
                                )}

                                {/* Dönüştürülmüşse Satış Kodu */}
                                {q.converted_sale_code && (
                                    <div className="px-8 py-3 bg-blue-50 border-t border-blue-200">
                                        <span className="text-xs text-blue-700 font-bold">✓ Satışa Çevrildi — Satış No: </span>
                                        <span className="text-xs text-blue-900 font-mono font-black">{q.converted_sale_code}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Butonlar */}
                        <div className="border-t border-slate-200 px-4 py-3 bg-white flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                            <div className="flex gap-2 flex-wrap">
                                {q.status !== 'Satışa Çevrildi' && q.status !== 'Reddedildi' && (
                                    <button
                                        onClick={() => { priceQuotesAPI.update(q.id, { status: 'Onaylandı' }).then(() => { setSelectedQuote(prev => ({ ...prev, status: 'Onaylandı' })); loadQuotes(); }); }}
                                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-xs transition-colors"
                                    >✓ Onayla</button>
                                )}
                                {q.status !== 'Satışa Çevrildi' && q.status !== 'Reddedildi' && (
                                    <button
                                        onClick={() => { priceQuotesAPI.update(q.id, { status: 'Reddedildi' }).then(() => { setSelectedQuote(prev => ({ ...prev, status: 'Reddedildi' })); loadQuotes(); }); }}
                                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-xs transition-colors"
                                    >✗ Reddet</button>
                                )}
                                {q.status !== 'Satışa Çevrildi' && (
                                    <button
                                        onClick={() => openEditQuoteModal(q)}
                                        className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">edit</span>Düzenle
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => setShowViewQuoteModal(false)} className="px-4 py-1.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 text-xs transition-colors">Kapat</button>
                                <button
                                    onClick={() => printQuote(q)}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow transition-all text-xs flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-sm">print</span>A5
                                </button>
                                <button
                                    onClick={() => printQuoteA4(q)}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow transition-all text-xs flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-sm">print</span>A4
                                </button>
                                {q.status !== 'Satışa Çevrildi' && (
                                    <button
                                        onClick={() => handleConvertToSale(q)}
                                        disabled={quoteConverting}
                                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-lg shadow transition-all text-xs flex items-center gap-1 disabled:opacity-60"
                                    >
                                        {quoteConverting
                                            ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>İşleniyor...</>
                                            : <><span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>Satışa Çevir</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        })()}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        </>
    );
}
