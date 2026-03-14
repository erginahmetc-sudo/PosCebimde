import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { customersAPI, salesAPI, productsAPI, logsAPI } from '../services/api';
import { supabase } from '../lib/supabaseClient';
import SaleDetailModal from '../components/modals/SaleDetailModal';

export default function CustomerDetailPage() {
    const { customerName } = useParams();
    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [products, setProducts] = useState([]);
    const [reportFilters, setReportFilters] = useState({ productName: '', stockCode: '', barcode: '' });

    const openSaleDetail = (sale) => {
        // Log viewing details
        logsAPI.logAction({
            module: 'SATIŞLAR',
            action_type: 'VIEW',
            details: {
                title: `${sale.sale_code} numaralı Satış Detayı'na girildi.`,
                customer: sale.customer || customer?.name || 'Müşteri',
                total: `${parseFloat(sale.total || 0).toFixed(2)} TL`
            }
        });
        setSelectedSale(sale);
    };

    const handleTransactionClick = (tx) => {
        // Only open modal for sales (where we have products or items)
        // If it's a payment, we don't show sale detail modal but maybe a simple info?
        // Actually, requirement says "Diğer işlem türü satırlarına tıklayarak satış detaylarını görüntüleyebilme"

        // Check if it's a sale transaction (has sale_code or is not a payment type)
        if (tx.transactionType === 'Fatura' || tx.transactionType === 'Nakit' || tx.transactionType === 'K.Kartı' || tx.transactionType === 'Veresiye') {
            // Adapt tx to sale object expected by SaleDetailModal
            // The modal expects { sale_code, customer, payment_method, date, total, items/products ... }

            // If tx comes from sales table join, it might have items.
            // If it comes from customer_transactions view/rpc, check structure.
            // Assuming getTransactions returns enough info or we might need to fetch sale detail?
            // Let's assume tx object has enough info for now or we pass what we have.
            // Note: processedTransactions adds fields. Use raw tx if needed but processed is fine too.

            const saleObj = {
                sale_code: tx.sale_code || tx.id, // Fallback
                customer: customer.name,
                payment_method: tx.payment_method,
                date: tx.created_at,
                total: tx.total,
                items: tx.items || tx.products || [], // Access jsonb items (or products legacy)
                is_deleted: false // Assuming history items are valid
            };
            setSelectedSale(saleObj);
        }
    };

    // Double-click handler for Sales, Payments, and Purchase Invoices
    const handleRowDoubleClick = (tx) => {
        // If it's a PURCHASE INVOICE (Alış Faturası)
        if (tx.transactionType === 'Alış Faturası') {
            setSelectedInvoice(tx);
            return;
        }
        // If it's a SALE (has items or sale_code)
        if (tx.items?.length > 0 || (tx.transactionType && (tx.transactionType.includes('Satış') || tx.transactionType === 'Fatura'))) {
            const saleObj = {
                sale_code: tx.sale_code || tx.id,
                customer: customer.name,
                payment_method: tx.payment_method || 'Nakit',
                date: tx.created_at,
                total: tx.total,
                items: tx.items || tx.products || [],
                is_deleted: false
            };
            openSaleDetail(saleObj);
        }
        // If it's a PAYMENT
        else if (tx.transactionType?.includes('Ödeme')) {
            setEditingPayment(tx);
            setEditAmount(tx.total.toString());
        }
    };

    // Save edited payment
    const handleSavePayment = async () => {
        if (!editingPayment) return;

        const newAmount = parseFloat(editAmount);
        if (isNaN(newAmount) || newAmount <= 0) {
            alert('Geçerli bir tutar giriniz.');
            return;
        }

        try {
            await customersAPI.updatePayment(editingPayment.id, customer.id, editingPayment.total, newAmount);
            setEditingPayment(null);
            setEditAmount('');
            loadCustomerData();
        } catch (error) {
            console.error(error);
            alert('Hata: ' + (error.message || 'Ödeme güncellenemedi'));
        }
    };

    const handleDeletePayment = async (e, tx) => {
        e.stopPropagation(); // Prevent row click

        if (!confirm('Bu ödemeyi silmek müşterinin borcunu artıracaktır. Emin misiniz?')) return;

        try {
            await customersAPI.deletePayment(tx.id, customer.id, tx.total); // tx.total is amount for payment
            alert('Ödeme silindi.');
            loadCustomerData();
        } catch (error) {
            console.error(error);
            alert('Hata: ' + (error.message || 'Ödeme silinemedi'));
        }
    };

    useEffect(() => {
        loadCustomerData();
    }, [customerName]);

    // Load products for invoice editing
    useEffect(() => {
        const loadProducts = async () => {
            try {
                const res = await productsAPI.getAll();
                if (res.data?.products) setProducts(res.data.products);
            } catch (e) { console.error('Products fetch error:', e); }
        };
        loadProducts();
    }, []);

    const loadCustomerData = async () => {
        try {
            // Get all customers and find the one matching the name
            const { data: customersData } = await customersAPI.getAll();
            const customers = customersData?.customers || [];
            const foundCustomer = customers.find(c => c.name === decodeURIComponent(customerName));

            if (foundCustomer) {
                setCustomer(foundCustomer);

                // Get transactions for this customer
                const { data: txData } = await customersAPI.getTransactions(foundCustomer.id);
                const transactions = txData?.transactions || [];

                // Get sales to enrich transactions with product details
                const { data: salesData } = await salesAPI.getAll({ customer_id: foundCustomer.id });
                const salesMap = (salesData?.sales || []).reduce((acc, sale) => {
                    acc[sale.sale_code] = sale;
                    return acc;
                }, {});

                // Merge items into transactions
                const enrichedTransactions = transactions.map(tx => {
                    if (tx.sale_code && salesMap[tx.sale_code]) {
                        return {
                            ...tx,
                            items: salesMap[tx.sale_code].items || salesMap[tx.sale_code].products || []
                        };
                    }
                    return tx;
                });

                setTransactions(enrichedTransactions);
            }
        } catch (error) {
            console.error('Müşteri verileri yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatCurrency = (amount) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calculate running balance and categorize transactions
    // Each row is either Borç (Debit) OR Alacak (Credit), never both
    const processedTransactions = transactions.map((tx, index) => {
        const rawAmount = parseFloat(tx.amount) || 0;
        const total = Math.abs(rawAmount);
        const paymentType = tx.payment_type || '';

        let debtAmount = 0;
        let creditAmount = 0;
        let transactionType = 'İşlem';

        // Negative amount or "Borç" in type = Borç (Debit) entry
        // Positive amount = Alacak (Credit) entry
        if (rawAmount < 0 || paymentType.toLowerCase().includes('borç')) {
            // This is a DEBIT (Borç) - only Borç Tutarı filled
            debtAmount = total;
            creditAmount = 0;
            transactionType = 'Satış (Borç)';
        } else {
            // This is a CREDIT (Alacak) - only Alacak Tutarı filled
            creditAmount = total;
            debtAmount = 0;
            if (paymentType.toLowerCase().includes('fatura') && paymentType.toLowerCase().includes('alış')) transactionType = 'Alış Faturası';
            else if (paymentType.toLowerCase().includes('nakit')) transactionType = 'Ödeme (Nakit)';
            else if (paymentType.toLowerCase().includes('kredi') || paymentType.toLowerCase().includes('kart')) transactionType = 'Ödeme (K.Kartı)';
            else transactionType = 'Ödeme';
        }

        // Row colors based on type
        let rowColor = transactionType === 'Alış Faturası' ? 'bg-indigo-50' : debtAmount > 0 ? 'bg-yellow-100' : 'bg-cyan-100';

        return {
            ...tx,
            total,
            debtAmount,
            creditAmount,
            transactionType,
            rowColor
        };
    });

    // Calculate totals from transactions
    const totals = processedTransactions.reduce((acc, tx) => ({
        debt: acc.debt + tx.debtAmount,
        credit: acc.credit + tx.creditAmount
    }), { debt: 0, credit: 0 });

    // Use customer.balance from database for accuracy (this is the source of truth)
    const customerBalance = parseFloat(customer?.balance) || 0;
    // calculated balance from transactions for display consistency
    const calculatedBalance = totals.debt - totals.credit;
    // Use the CALCULATED balance for display to match the shown totals
    const netBalance = calculatedBalance;

    // Filter Logic
    const filteredTransactions = processedTransactions.filter(tx => {
        if (!reportFilters.productName && !reportFilters.stockCode && !reportFilters.barcode) return true;

        // Only sales have items to filter by
        const items = tx.items || tx.products || [];
        if (items.length === 0) return false;

        return items.some(item => {
            const nameMatch = !reportFilters.productName || item.name?.toLocaleLowerCase('tr-TR').includes(reportFilters.productName.toLocaleLowerCase('tr-TR'));
            const stockMatch = !reportFilters.stockCode || item.stock_code?.toLowerCase().includes(reportFilters.stockCode.toLowerCase());
            const barcodeMatch = !reportFilters.barcode || item.barcode?.toLowerCase().includes(reportFilters.barcode.toLowerCase());
            return nameMatch && stockMatch && barcodeMatch;
        });
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="bg-white rounded-lg p-8 text-center shadow-md">
                    <h2 className="text-2xl font-bold text-gray-700">Müşteri Bulunamadı</h2>
                    <Link to="/customers" className="mt-4 inline-block px-6 py-2 bg-blue-500 text-white rounded-lg">
                        Müşterilere Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white px-6 py-4 shadow-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/customers"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Cari Hareket Raporu</h1>
                            <p className="text-gray-500 text-sm">
                                {customer.customer_code} - {customer.name}
                            </p>
                        </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="flex gap-4">
                        <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                            <span className="text-sm text-red-600">Toplam Borç:</span>
                            <span className="ml-2 font-bold text-red-700">{formatCurrency(totals.debt)} TL</span>
                        </div>
                        <div className="px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                            <span className="text-sm text-green-600">Toplam Alacak:</span>
                            <span className="ml-2 font-bold text-green-700">{formatCurrency(totals.credit)} TL</span>
                        </div>
                        <div className={`px-4 py-2 rounded-lg border ${netBalance > 0 ? 'bg-red-100 border-red-300' : netBalance < 0 ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'}`}>
                            <span className="text-sm text-gray-600">Net Bakiye:</span>
                            <span className={`ml-2 font-bold ${netBalance > 0 ? 'text-red-700' : netBalance < 0 ? 'text-green-700' : 'text-gray-700'}`}>
                                {formatCurrency(Math.abs(netBalance))} TL {netBalance > 0 ? '(Borçlu)' : netBalance < 0 ? '(Alacaklı)' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Table */}
            <div className="p-4">
                {/* Search Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Ürün Adı</label>
                        <input
                            type="text"
                            value={reportFilters.productName}
                            onChange={(e) => setReportFilters({ ...reportFilters, productName: e.target.value })}
                            placeholder="Ürün adı ara..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Stok Kodu</label>
                        <input
                            type="text"
                            value={reportFilters.stockCode}
                            onChange={(e) => setReportFilters({ ...reportFilters, stockCode: e.target.value })}
                            placeholder="Stok kodu ara..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Barkod</label>
                        <input
                            type="text"
                            value={reportFilters.barcode}
                            onChange={(e) => setReportFilters({ ...reportFilters, barcode: e.target.value })}
                            placeholder="Barkod ara..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setReportFilters({ productName: '', stockCode: '', barcode: '' })}
                            className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold hover:bg-gray-200 transition-colors h-full"
                        >
                            Temizle
                        </button>
                        <button
                            onClick={() => {
                                const headers = ['Cari Kodu', 'Ticari Ünvanı', 'Evrak No', 'İşlem Tarihi', 'Borç', 'Alacak', 'Bakiye', 'İşlem Türü', 'Ödeme Tipi', 'Açıklama'];
                                const data = filteredTransactions.map((tx, idx) => {
                                    const runningBalance = filteredTransactions.slice(0, idx + 1).reduce((acc, t) => acc + t.debtAmount - t.creditAmount, 0);
                                    return [
                                        customer.customer_code,
                                        customer.name,
                                        tx.sale_code || tx.id?.substring(0, 8),
                                        formatDate(tx.created_at),
                                        tx.debtAmount,
                                        tx.creditAmount,
                                        Math.abs(runningBalance),
                                        tx.transactionType,
                                        (tx.transactionType === 'Satış (Borç)' ? (tx.payment_method || 'Veresiye') : ''),
                                        tx.description ? (() => { try { const p = JSON.parse(tx.description); return p.summary || tx.description; } catch { return tx.description; } })() : ''
                                    ];
                                });
                                // Add headers
                                data.unshift(headers);
                                const ws = XLSX.utils.aoa_to_sheet(data);

                                // Apply Column Widths
                                ws['!cols'] = [
                                    { wch: 15 }, // Cari Kodu
                                    { wch: 25 }, // Ticari Ünvanı
                                    { wch: 15 }, // Evrak No
                                    { wch: 20 }, // Tarih
                                    { wch: 12 }, // Borç
                                    { wch: 12 }, // Alacak
                                    { wch: 12 }, // Bakiye
                                    { wch: 15 }, // İşlem Türü
                                    { wch: 15 }, // Ödeme Tipi
                                    { wch: 40 }  // Açıklama
                                ];

                                // Apply Styles
                                const range = XLSX.utils.decode_range(ws['!ref']);
                                for (let R = 1; R <= range.e.r; ++R) { // Start from R=1 to skip header
                                    const txIndex = R - 1; // Corresponding transaction index
                                    if (txIndex < filteredTransactions.length) {
                                        const tx = filteredTransactions[txIndex];
                                        let rowStyle = null;

                                        if (tx.transactionType === 'Satış (Borç)') {
                                            rowStyle = {
                                                fill: { fgColor: { rgb: "E0F7FA" } }, // Light Cyan
                                                font: { color: { rgb: "000000" } }
                                            };
                                        } else if (tx.transactionType.includes('Ödeme')) {
                                            rowStyle = {
                                                fill: { fgColor: { rgb: "FFF9C4" } }, // Light Yellow
                                                font: { color: { rgb: "000000" } }
                                            };
                                        }

                                        if (rowStyle) {
                                            for (let C = range.s.c; C <= range.e.c; ++C) {
                                                const cell_address = { c: C, r: R };
                                                const cell_ref = XLSX.utils.encode_cell(cell_address);
                                                if (!ws[cell_ref]) continue;
                                                ws[cell_ref].s = rowStyle;
                                            }
                                        }
                                    }
                                }

                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Cari Hareket");
                                XLSX.writeFile(wb, `${customer.name}_Cari_Hareket_Raporu_${new Date().toLocaleDateString()}.xlsx`);
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-1 h-full"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Excel İle Dışarı Aktar
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-blue-600 text-white">
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Cari Kodu</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Ticari Ünvanı</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Evrak No</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">İşlem Tarihi</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">Borç Tutarı</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">Alacak Tutarı</th>
                                    <th className="px-3 py-2 text-right font-semibold border-r border-blue-500">KPB Bakiyesi</th>
                                    <th className="px-3 py-2 text-center font-semibold border-r border-blue-500">KPB B/A/S</th>
                                    <th className="px-3 py-2 text-center font-semibold border-r border-blue-500">İşlem Türü</th>
                                    <th className="px-3 py-2 text-left font-semibold border-r border-blue-500">Açıklama</th>
                                    <th className="px-3 py-2 text-center font-semibold w-16">Sil</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                            Bu müşteriye ait hareket bulunmamaktadır.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx, idx) => {
                                        // Calculate running balance up to this transaction within the filtered list
                                        const runningBalance = filteredTransactions
                                            .slice(0, idx + 1)
                                            .reduce((acc, t) => acc + t.debtAmount - t.creditAmount, 0);

                                        return (
                                            <tr
                                                key={tx.id || idx}
                                                className={`${tx.rowColor} border-b border-gray-200 hover:opacity-80 cursor-pointer transition-colors`}
                                                onClick={() => { }} // Single click disabled as per request (focus on double click)
                                                onDoubleClick={() => handleRowDoubleClick(tx)}
                                            >
                                                <td className="px-2 py-1 border-r border-gray-200 font-medium">
                                                    {customer.customer_code}
                                                </td>
                                                <td className="px-2 py-1 border-r border-gray-200">
                                                    {customer.name}
                                                </td>
                                                <td className="px-2 py-1 border-r border-gray-200 font-mono text-[10px]">
                                                    {tx.sale_code || tx.id?.substring(0, 8) || '-'}
                                                </td>
                                                <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">
                                                    {formatDate(tx.created_at)}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 text-right font-medium">
                                                    {tx.debtAmount > 0 ? formatCurrency(tx.debtAmount) : ''}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-200 text-right font-medium">
                                                    {tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : ''}
                                                </td>
                                                <td className="px-2 py-1 border-r border-gray-200 text-right font-bold">
                                                    {formatCurrency(Math.abs(runningBalance))}
                                                </td>
                                                <td className={`px-2 py-1 border-r border-gray-200 text-center font-bold ${runningBalance > 0 ? 'text-red-600' : runningBalance < 0 ? 'text-green-600' : 'text-gray-600'
                                                    }`}>
                                                    {runningBalance > 0 ? 'Borç' : runningBalance < 0 ? 'Alacak' : 'Sıfır'}
                                                </td>
                                                <td className={`px-2 py-1 border-r border-gray-200 text-center font-semibold ${tx.transactionType === 'Fatura' ? 'text-blue-600' :
                                                    tx.transactionType === 'Nakit' ? 'text-green-600' :
                                                        tx.transactionType === 'Ödeme' ? 'text-purple-600' : 'text-gray-600'
                                                    }`}>
                                                    {tx.transactionType}
                                                    {tx.transactionType === 'Satış (Borç)' && (
                                                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                                                            {tx.payment_method || 'Veresiye'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1 text-left max-w-md border-r border-gray-200">
                                                    <div className="flex flex-col">
                                                        <span className="truncate" title={(() => { try { const p = JSON.parse(tx.description); return p.summary || tx.description; } catch { return tx.description || ''; } })()}>
                                                            {(() => { try { const p = JSON.parse(tx.description); return p.summary || tx.description; } catch { return tx.description || '-'; } })()}
                                                        </span>
                                                        {/* Show item names from JSON data or from enriched tx */}
                                                        {(() => {
                                                            try {
                                                                const p = JSON.parse(tx.description);
                                                                if (p.items?.length > 0) return (
                                                                    <span className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                                                        {p.items.map(it => it.name).join(', ')}
                                                                    </span>
                                                                );
                                                            } catch { /* not JSON */ }
                                                            const items = tx.items || tx.products;
                                                            if (items?.length > 0) return (
                                                                <span className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                                                    {items.map(p => p.name).join(', ')}
                                                                </span>
                                                            );
                                                            return null;
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1 text-center">
                                                    {tx.transactionType === 'Ödeme' && (
                                                        <button
                                                            onClick={(e) => handleDeletePayment(e, tx)}
                                                            className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                                                            title="Ödemeyi Sil"
                                                        >
                                                            Sil
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}

                                {/* Totals Row */}
                                {filteredTransactions.length > 0 && (
                                    <tr className={`font-bold text-sm ${netBalance > 0 ? 'bg-red-200' : netBalance < 0 ? 'bg-green-200' : 'bg-gray-200'}`}>
                                        <td colSpan={4} className="px-2 py-2 border-r border-gray-300 text-right uppercase">
                                            Toplam:
                                        </td>
                                        <td className="px-2 py-2 border-r border-gray-300 text-right text-red-700">
                                            {formatCurrency(totals.debt)}
                                        </td>
                                        <td className="px-2 py-2 border-r border-gray-300 text-right text-green-700">
                                            {formatCurrency(totals.credit)}
                                        </td>
                                        <td className="px-2 py-2 border-r border-gray-300 text-right">
                                            {formatCurrency(Math.abs(netBalance))}
                                        </td>
                                        <td className={`px-2 py-2 border-r border-gray-300 text-center ${netBalance > 0 ? 'text-red-700' : netBalance < 0 ? 'text-green-700' : ''
                                            }`}>
                                            {netBalance > 0 ? 'YÜKSEL' : netBalance < 0 ? 'ALACAK' : 'SIFIR'}
                                        </td>
                                        <td colSpan={3} className="px-2 py-2"></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sale Detail Modal */}
            {selectedSale && (
                <SaleDetailModal
                    sale={selectedSale}
                    onClose={() => setSelectedSale(null)}
                    onUpdate={() => {
                        loadCustomerData();
                        setSelectedSale(null);
                    }}
                    onDelete={() => {
                        loadCustomerData();
                        setSelectedSale(null);
                    }}
                />
            )}

            {/* Payment Edit Modal */}
            {editingPayment && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">Ödeme Düzenle</h3>
                            <p className="text-blue-100 text-sm mt-1">{editingPayment.description || 'Ödeme'}</p>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Mevcut Tutar</label>
                                <div className="text-xl font-bold text-gray-400 line-through">
                                    {editingPayment.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Yeni Tutar (TL)</label>
                                <input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    autoFocus
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-2">
                                <span>Tarih:</span>
                                <span>{new Date(editingPayment.created_at).toLocaleDateString('tr-TR')}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 space-y-3">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setEditingPayment(null); setEditAmount(''); }}
                                    className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSavePayment}
                                    className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
                                >
                                    Kaydet
                                </button>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!confirm('Bu ödemeyi silmek müşterinin borcunu artıracaktır. Emin misiniz?')) return;
                                    try {
                                        await customersAPI.deletePayment(editingPayment.id, customer.id, editingPayment.total);
                                        setEditingPayment(null);
                                        setEditAmount('');
                                        loadCustomerData();
                                    } catch (error) {
                                        console.error(error);
                                        alert('Hata: ' + (error.message || 'Ödeme silinemedi'));
                                    }
                                }}
                                className="w-full px-4 py-3 text-red-600 bg-red-50 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors"
                            >
                                Ödemeyi Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Invoice Detail Modal (Read-Only) */}
            {selectedInvoice && (() => {
                // Parse invoice data from description (JSON)
                let invoiceData = null;
                try {
                    invoiceData = JSON.parse(selectedInvoice.description);
                } catch { /* not JSON, legacy entry */ }

                const items = invoiceData?.items || [];
                const supplierInfo = invoiceData?.supplier || {};
                const invoiceDetails = invoiceData?.invoiceDetails || {};

                const calcLineTotal = (item) => {
                    let p = (item.quantity || 0) * (item.price || 0);
                    if (item.disc1) p -= p * (item.disc1 / 100);
                    if (item.disc2) p -= p * (item.disc2 / 100);
                    if (item.disc3) p -= p * (item.disc3 / 100);
                    if (item.disc4) p -= p * (item.disc4 / 100);
                    const vat = p * ((item.vatRate || 0) / 100);
                    return p + vat;
                };

                const subTotal = items.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p;
                }, 0);
                const vatTotal = items.reduce((sum, it) => {
                    let p = (it.quantity || 0) * (it.price || 0);
                    if (it.disc1) p -= p * (it.disc1 / 100);
                    if (it.disc2) p -= p * (it.disc2 / 100);
                    if (it.disc3) p -= p * (it.disc3 / 100);
                    if (it.disc4) p -= p * (it.disc4 / 100);
                    return sum + p * ((it.vatRate || 0) / 100);
                }, 0);
                const grandTotal = invoiceData?.totals?.grandTotal || (subTotal + vatTotal);

                return (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined">receipt_long</span>
                                        Alış Faturası Detayları
                                        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-medium">Salt Okunur</span>
                                    </h2>
                                    <p className="text-indigo-200 text-sm mt-0.5">
                                        {customer.name} • {new Date(selectedInvoice.created_at).toLocaleDateString('tr-TR')}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedInvoice(null)} className="text-white/70 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {!invoiceData ? (
                                    /* Legacy Entry */
                                    <div className="space-y-4">
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <p className="text-amber-700 text-sm font-medium flex items-center gap-2">
                                                <span className="material-symbols-outlined text-lg">info</span>
                                                Bu fatura eski formatta kaydedilmiş. Detaylı ürün bilgisi mevcut değil.
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Tutar</p>
                                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(selectedInvoice.total)} TL</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Açıklama</p>
                                            <p className="text-sm text-slate-800">{selectedInvoice.description || '-'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Supplier & Invoice Info */}
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
                                                    <div className="flex justify-between"><span className="text-slate-500">Seri No:</span><span className="font-medium text-slate-800">{invoiceDetails.serialNo || '-'}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Tarih:</span><span className="font-medium text-slate-800">{invoiceDetails.date ? new Date(invoiceDetails.date).toLocaleDateString('tr-TR') : '-'}</span></div>
                                                    {invoiceDetails.dueDate && (
                                                        <div className="flex justify-between"><span className="text-slate-500">Vade:</span><span className="font-medium text-slate-800">{new Date(invoiceDetails.dueDate).toLocaleDateString('tr-TR')}</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Products Table (Read-Only) */}
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
                                                <h3 className="font-semibold flex items-center gap-2 text-slate-900 text-sm">
                                                    <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                                                    Ürün Kalemleri ({items.length})
                                                </h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                            <th className="px-2 py-2 border-b border-slate-200 w-8 text-center">#</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 w-24 text-left">Stok Kodu</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-left">Ürün Adı</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">Miktar</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-20">B. Fiyat</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-center w-14">KDV%</th>
                                                            <th className="px-2 py-2 border-b border-slate-200 text-right w-24">Toplam</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {items.map((item, index) => {
                                                            const lineTotal = calcLineTotal(item);
                                                            return (
                                                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-2 py-2 text-xs text-slate-400 text-center">{index + 1}</td>
                                                                    <td className="px-2 py-2 text-xs font-mono font-medium text-slate-600">{item.stockCode || '-'}</td>
                                                                    <td className="px-2 py-2 text-xs font-semibold text-slate-900">{item.name || '-'}</td>
                                                                    <td className="px-2 py-2 text-xs text-center font-medium text-slate-800">{item.quantity}</td>
                                                                    <td className="px-2 py-2 text-xs text-right font-medium text-slate-800">{formatCurrency(item.price)}</td>
                                                                    <td className="px-2 py-2 text-xs text-center text-slate-600">%{item.vatRate || 0}</td>
                                                                    <td className="px-2 py-2 text-xs text-right font-bold text-slate-700">{formatCurrency(lineTotal)} TL</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                {items.length === 0 && (
                                                    <div className="p-8 text-center">
                                                        <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">inventory_2</span>
                                                        <p className="text-slate-500 text-sm font-medium">Ürün kalemi bulunamadı</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note & Totals */}
                                        {(invoiceData.note || items.length > 0) && (
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
                                                        <span className="font-semibold text-slate-900">{formatCurrency(subTotal)} TL</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">KDV Toplamı</span>
                                                        <span className="font-semibold text-slate-900">{formatCurrency(vatTotal)} TL</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-300">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Genel Toplam</span>
                                                            <span className="text-xl font-extrabold text-slate-900">{formatCurrency(grandTotal)} TL</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Footer - Only Close Button (Read-Only) */}
                            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end flex-shrink-0">
                                <button
                                    onClick={() => setSelectedInvoice(null)}
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
        </div>
    );
}
