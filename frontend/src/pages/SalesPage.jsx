import React, { useState, useEffect, useMemo } from 'react';
import { salesAPI, productsAPI, settingsAPI, customersAPI, logsAPI } from '../services/api';
import { birFaturaAPI } from '../services/birFaturaService';
import StatusModal from '../components/modals/StatusModal';
import ConfirmModal from '../components/modals/ConfirmModal';

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

    // Modal Notifications State
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'primary', onConfirm: () => { } });

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

            const res = await salesAPI.getAll(params);
            setSales(res.data?.sales || []);
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
        const customerName = sale.customerName || sale.customer || '';
        if (!customerName || customerName === 'Toptan Satış' || customerName === 'Misafir') return;

        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            setStatusModal({
                isOpen: true,
                title: 'Ayarlar Eksik',
                message: 'BirFatura ayarları bulunamadı. Ayarlar sayfasından API anahtarlarını kaydedin.',
                type: 'warning'
            });
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
                            name: cust.name || customerName,
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
                setStatusModal({
                    isOpen: true,
                    title: 'Fatura Hatası',
                    message: result.message,
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Fatura kesme hatası:', error);
            setStatusModal({
                isOpen: true,
                title: 'Fatura Kesme Hatası',
                message: error.message,
                type: 'error'
            });
        } finally {
            setInvoiceLoadingSaleId(null);
        }
    };

    // Open Modal
    const openDetailModal = (sale) => {
        // Log viewing details
        logsAPI.logAction({
            module: 'SATIŞLAR',
            action_type: 'VIEW',
            details: {
                title: `${sale.sale_code} numaralı Satış Detayı'na girildi.`,
                sale_code: sale.sale_code,
                customer: sale.customerName || sale.customer || 'Misafir',
                total: `${sale.total.toFixed(2)} TL`
            }
        });

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

    const handleSaveSale = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Değişiklikleri Kaydet',
            message: 'Satış üzerindeki değişiklikleri kaydetmek istiyor musunuz?',
            type: 'primary',
            onConfirm: async () => {
                try {
                    await salesAPI.update(editForm.sale_code, {
                        items: editForm.items,
                        total: totals.grand,
                        payment_method: editForm.payment_method,
                        customer_name: editForm.customer_name
                    });
                    setStatusModal({
                        isOpen: true,
                        title: 'Başarılı',
                        message: 'Satış başarıyla güncellendi.',
                        type: 'success'
                    });
                    setIsDetailModalOpen(false);
                    loadSales();
                } catch (error) {
                    setStatusModal({
                        isOpen: true,
                        title: 'Hata',
                        message: 'Güncelleme sırasında bir hata oluştu: ' + error.message,
                        type: 'error'
                    });
                }
            }
        });
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
            name: 'Firma İsmi Yazınız',
            address: 'Firma Adresi Yazınız',
            phone: '0212 XXX XX XX',
            logo_text: 'F',
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
        const companyName = localStorage.getItem('receipt_company_name') || 'Firma İsmi Yazınız';
        const companyAddress = localStorage.getItem('receipt_company_address') || 'Firma Adresi Yazınız';
        const companyPhone = localStorage.getItem('receipt_company_phone') || '0212 XXX XX XX';

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
        setConfirmModal({
            isOpen: true,
            title: 'Satışı Sil',
            message: 'Bu satışı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await salesAPI.delete(editForm.sale_code);
                    setStatusModal({
                        isOpen: true,
                        title: 'Silindi',
                        message: 'Satış kaydı başarıyla silindi.',
                        type: 'success'
                    });
                    setIsDetailModalOpen(false);
                    loadSales();
                } catch (error) {
                    setStatusModal({
                        isOpen: true,
                        title: 'Hata',
                        message: 'Silme işlemi sırasında bir hata oluştu: ' + error.message,
                        type: 'error'
                    });
                }
            }
        });
    };

    // Filter Logic
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const term = filters.searchTerm.toLowerCase();
            const matchesGeneral = !term ||
                sale.sale_code?.toLowerCase().includes(term) ||
                sale.customerName?.toLowerCase().includes(term) ||
                sale.customer?.toLowerCase().includes(term);

            if (!matchesGeneral) return false;

            const total = sale.total || 0;
            if (filters.minPrice && total < parseFloat(filters.minPrice)) return false;
            if (filters.maxPrice && total > parseFloat(filters.maxPrice)) return false;

            const hasItemFilters = filters.stockCode || filters.productName || filters.barcode;
            if (hasItemFilters) {
                const items = sale.items || [];
                if (items.length === 0) return false;
                const matchesItemCriteria = items.some(item => {
                    let match = true;
                    if (filters.stockCode && !item.stock_code?.toLowerCase().includes(filters.stockCode.toLowerCase())) match = false;
                    if (filters.productName && !item.name?.toLowerCase().includes(filters.productName.toLowerCase())) match = false;
                    if (filters.barcode && !item.barcode?.toLowerCase().includes(filters.barcode.toLowerCase())) match = false;
                    return match;
                });
                if (!matchesItemCriteria) return false;
            }
            return true;
        });
    }, [sales, filters]);

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

            {/* Notification Modals */}
            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />
        </div>
    );
}
