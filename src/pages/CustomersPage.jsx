import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import * as XLSX from 'xlsx';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupFilter, setGroupFilter] = useState('Tümü');
    const [statusFilter, setStatusFilter] = useState('Aktif');
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        customer_code: '',
        name: '',
        company: '',
        group: 'Cari',
        is_active: true,
        address: '',
        city: '',
        district: '',
        zip_code: '',
        country: '',
        tax_office: '',
        tax_number: '',
    });

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [transactionType, setTransactionType] = useState('payment'); // 'payment' (collection) or 'debt' (manual debit)
    const [paymentData, setPaymentData] = useState({
        customer_id: '',
        amount: '',
        description: 'Ödeme',
        payment_type: 'Nakit'
    });


    // Customer Search Modal State
    const [showCustomerSearchModal, setShowCustomerSearchModal] = useState(false);
    const [searchCustomerTerm, setSearchCustomerTerm] = useState('');

    // Excel Import Modal State
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [excelImporting, setExcelImporting] = useState(false);
    const [excelPreview, setExcelPreview] = useState([]);
    const [importResult, setImportResult] = useState({ show: false, success: 0, error: 0 });

    const filteredSearchCustomers = showCustomerSearchModal ? customers.filter(c => {
        const term = searchCustomerTerm.toLowerCase();
        return ((c.name || '').toLowerCase().includes(term) ||
            (c.tax_number || '').includes(term) ||
            (c.customer_code || '').toLowerCase().includes(term));
    }) : [];

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await customersAPI.getAll();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Müşteriler yüklenirken hata:', error);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    const groups = ['Tümü', 'Cari', 'Perakende', 'Firmalar'];
    const statuses = ['Tümü', 'Aktif', 'Pasif'];

    const filteredCustomers = customers.filter((c) => {
        const isActive = c.is_active !== false;

        // Status filter
        if (statusFilter === 'Aktif' && !isActive) return false;
        if (statusFilter === 'Pasif' && isActive) return false;

        // Group filter
        if (groupFilter !== 'Tümü' && (c.group || 'Cari') !== groupFilter) return false;

        // Search filter
        if (searchTerm) {
            const searchString = `${c.customer_code || ''} ${c.name} ${c.city} ${c.district}`.toLowerCase();
            if (!searchString.includes(searchTerm.toLowerCase())) return false;
        }

        return true;
    }).sort((a, b) => {
        if (!sortColumn) return 0;

        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (sortColumn === 'balance') {
            aVal = parseFloat(a.balance) || 0;
            bVal = parseFloat(b.balance) || 0;
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        aVal = (aVal || '').toString();
        bVal = (bVal || '').toString();
        return sortDirection === 'asc'
            ? aVal.localeCompare(bVal, 'tr')
            : bVal.localeCompare(aVal, 'tr');
    });

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const openAddModal = () => {
        setFormData({
            customer_code: '',
            name: '',
            company: '',
            group: 'Cari',
            is_active: true,
            address: '',
            city: '',
            district: '',
            zip_code: '',
            country: '',
            tax_office: '',
            tax_number: '',
        });
        setShowAddModal(true);
    };

    const openEditModal = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            customer_code: customer.customer_code || '',
            name: customer.name || '',
            company: customer.company || '',
            group: customer.group || 'Cari',
            is_active: customer.is_active !== false,
            address: customer.address || '',
            city: customer.city || '',
            district: customer.district || '',
            zip_code: customer.zip_code || '',
            country: customer.country || '',
            tax_office: customer.tax_office || '',
            tax_number: customer.tax_number || '',
        });
        setShowEditModal(true);
    };

    // Generate next customer code based on existing codes
    const generateNextCustomerCode = () => {
        // Find all existing customer codes that match "M" + digits pattern
        const existingCodes = customers
            .map(c => c.customer_code)
            .filter(code => code && /^M\d+$/.test(code))
            .map(code => parseInt(code.substring(1), 10));

        // Find the maximum number, default to 0 if no codes exist
        const maxNum = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;

        // Generate next code with 4-digit padding (M0001, M0002, etc.)
        const nextNum = maxNum + 1;
        return `M${nextNum.toString().padStart(4, '0')}`;
    };

    const handleSaveNew = async () => {
        if (!formData.name.trim()) {
            alert('Müşteri adı boş bırakılamaz.');
            return;
        }

        // Auto-generate customer code if empty
        const customerData = { ...formData };
        if (!customerData.customer_code.trim()) {
            customerData.customer_code = generateNextCustomerCode();
        }

        try {
            const response = await customersAPI.add(customerData);
            if (response.data?.success) {
                alert(response.data.message);
                setShowAddModal(false);
                loadCustomers();
            } else {
                alert('Hata: ' + response.data?.message);
            }
        } catch (error) {
            alert('Müşteri eklenirken hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSaveEdit = async () => {
        if (!editingCustomer) return;

        try {
            const response = await customersAPI.update(editingCustomer.id, formData);
            if (response.data?.success) {
                alert(response.data.message);
                setShowEditModal(false);
                loadCustomers();
            } else {
                alert('Güncelleme hatası: ' + response.data?.message);
            }
        } catch (error) {
            alert('Güncelleme hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelete = async (id) => {
        // Check if customer has any transactions
        const customer = customers.find(c => c.id === id);
        const hasTransactions = customer && ((parseFloat(customer.total_debt) || 0) > 0 || (parseFloat(customer.total_credit) || 0) > 0);

        if (hasTransactions) {
            const setPasif = confirm(
                'Bu müşterinin satış veya ödeme işlemleri bulunduğu için silinemez.\n\n' +
                'Müşteriyi "Pasif" konuma getirmek ister misiniz?'
            );
            if (setPasif) {
                try {
                    await customersAPI.update(id, { is_active: false });
                    alert('Müşteri pasif konuma getirildi.');
                    loadCustomers();
                } catch (error) {
                    alert('Güncelleme hatası: ' + (error.response?.data?.message || error.message));
                }
            }
            return;
        }

        if (!confirm('Kalıcı olarak silmek istediğinize emin misiniz?')) return;

        try {
            const response = await customersAPI.delete(id);
            alert(response.data?.message);
            if (response.data?.success) loadCustomers();
        } catch (error) {
            alert('Silme hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const handlePaymentSubmit = async () => {
        if (!paymentData.customer_id || !paymentData.amount) {
            alert('Lütfen müşteri seçin ve tutar girin.');
            return;
        }
        try {
            let response;
            if (transactionType === 'payment') {
                // Customer pays US (Collection) -> Reduces Balance
                response = await customersAPI.addPayment(paymentData);
            } else {
                // We pay Customer / Add Debt (Debit) -> Increases Balance
                // Note: 'Firmaya Ödeme Yap' button maps to this. User requested it adds Debt.
                response = await customersAPI.addManualDebit(paymentData);
            }

            if (response.data?.success) {
                alert(response.data.message);
                setShowPaymentModal(false);
                loadCustomers();
                setPaymentData({ customer_id: '', amount: '', description: 'Ödeme', payment_type: 'Nakit' });
            } else {
                alert('Hata: ' + response.data?.message);
            }
        } catch (error) {
            alert('İşlem hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    // Excel Export Function
    const exportToExcel = () => {
        // Prepare CSV content (Excel compatible)
        const headers = ['Müşteri Kodu', 'Kısa Adı', 'Firma', 'Grubu', 'Durum', 'Bakiye', 'Şehir', 'İlçe', 'Adres', 'Vergi Dairesi', 'Vergi No'];
        const rows = filteredCustomers.map(c => [
            c.customer_code || '',
            c.name || '',
            c.company || '',
            c.group || 'Cari',
            c.is_active !== false ? 'Aktif' : 'Pasif',
            (parseFloat(c.balance) || 0).toFixed(2),
            c.city || '',
            c.district || '',
            c.address || '',
            c.tax_office || '',
            c.tax_number || ''
        ]);

        // Create CSV string with BOM for Turkish characters
        const BOM = '\uFEFF';
        const csvContent = BOM + [headers, ...rows].map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')
        ).join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Musteriler_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('tr-TR');
    };



    return (
        <div className="min-h-screen bg-gray-100 flex flex-col relative">

            {/* Modern Loading Screen - Variant 2 */}
            {loading && (
                <div className="absolute inset-0 z-[100] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-fashion transition-all duration-500">
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
            {/* Header */}
            <header className="bg-gradient-to-r from-slate-50 via-white to-blue-50/30 px-6 py-5 shadow-sm border-b border-gray-100 sticky top-0 z-20">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                            Müşteriler
                        </h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                                {customers.length}
                            </span>
                            müşteri kayıtlı
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                        <button
                            onClick={() => {
                                setPaymentData(prev => ({ ...prev, description: 'Ödeme' }));
                                setTransactionType('payment'); // Customer pays US (Collection)
                                setShowPaymentModal(true);
                            }}
                            className="flex-1 lg:flex-none min-w-fit px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Müşteriden Ödeme Al
                        </button>
                        <button
                            onClick={() => {
                                setPaymentData(prev => ({ ...prev, description: 'Firmaya Ödeme Yapıldı' }));
                                setTransactionType('debt'); // We pay CUSTOMER (Debit / Add Debt)
                                setShowPaymentModal(true);
                            }}
                            className="flex-1 lg:flex-none min-w-fit px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Firmaya Ödeme Yap
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="flex-1 lg:flex-none min-w-fit px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Excel İndir
                        </button>
                        <button
                            onClick={openAddModal}
                            className="flex-1 lg:flex-none min-w-fit px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-900/25 hover:shadow-xl hover:shadow-gray-900/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Müşteri
                        </button>
                        <button
                            onClick={() => setShowExcelModal(true)}
                            className="flex-1 lg:flex-none min-w-fit px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Excel İle Cari Yükle
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 p-5 flex flex-col">
                <div className="flex gap-5 items-start">
                    {/* Sidebar - Sticky */}
                    <div className="w-64 bg-white rounded-lg shadow-md p-5 flex-shrink-0 sticky top-28">
                        <h3 className="text-lg font-semibold border-b-2 border-gray-100 pb-2 mb-4">Filtreleme</h3>

                        <div className="mb-5">
                            <label className="block mb-1 font-bold text-gray-600 text-sm">Hesap Durumu:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                {statuses.map(s => <option key={s} value={s}>{s === 'Aktif' ? 'Sadece Aktifler' : s === 'Pasif' ? 'Sadece Pasifler' : s}</option>)}
                            </select>
                        </div>

                        <div className="mb-5">
                            <label className="block mb-1 font-bold text-gray-600 text-sm">Müşteri Grubu:</label>
                            <select
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                {groups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div className="mb-5">
                            <label className="block mb-1 font-bold text-gray-600 text-sm">Arama:</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Ad, Kod, Şehir vb. ara..."
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 bg-white rounded-lg shadow-md p-5">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('customer_code')} className="border border-gray-200 p-2 text-left bg-gray-50 cursor-pointer hover:bg-gray-100 font-semibold">Müşteri Kodu</th>
                                    <th onClick={() => handleSort('name')} className="border border-gray-200 p-2 text-left bg-gray-50 cursor-pointer hover:bg-gray-100 font-semibold">Kısa Adı</th>
                                    <th onClick={() => handleSort('group')} className="border border-gray-200 p-2 text-left bg-gray-50 cursor-pointer hover:bg-gray-100 font-semibold">Grubu</th>
                                    <th className="border border-gray-200 p-2 text-left bg-gray-50 font-semibold">Durum</th>
                                    <th onClick={() => handleSort('balance')} className="border border-gray-200 p-2 text-left bg-gray-50 cursor-pointer hover:bg-gray-100 font-semibold">Bakiye</th>
                                    <th className="border border-gray-200 p-2 text-left bg-gray-50 font-semibold">Bakiye Durumu</th>
                                    <th className="border border-gray-200 p-2 text-right bg-gray-50 font-semibold">Toplam Borç</th>
                                    <th className="border border-gray-200 p-2 text-right bg-gray-50 font-semibold">Toplam Alacak</th>
                                    <th className="border border-gray-200 p-2 text-left bg-gray-50 font-semibold">Son İşlem Tarihi</th>
                                    <th className="border border-gray-200 p-2 text-left bg-gray-50 font-semibold">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="border border-gray-200 p-4 text-center text-gray-500">
                                            Kriterlere uygun kayıt bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map(customer => {
                                        const balance = parseFloat(customer.balance) || 0;
                                        const isActive = customer.is_active !== false;

                                        return (
                                            <tr key={customer.id} className={!isActive ? 'opacity-60 bg-gray-50' : ''}>
                                                <td className="border border-gray-200 p-2 font-bold">{customer.customer_code || '-'}</td>
                                                <td className="border border-gray-200 p-2">{customer.name}</td>
                                                <td className="border border-gray-200 p-2">{customer.group || 'Cari'}</td>
                                                <td className="border border-gray-200 p-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${isActive ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                        {isActive ? 'Aktif' : 'Pasif'}
                                                    </span>
                                                </td>
                                                <td className={`border border-gray-200 p-2 font-bold ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-green-500' : ''}`}>
                                                    {balance.toFixed(2)} TL
                                                </td>
                                                <td className={`border border-gray-200 p-2 ${balance > 0 ? 'text-red-500' : balance < 0 ? 'text-green-500' : ''}`}>
                                                    {balance > 0 ? 'Borçlu' : balance < 0 ? 'Alacaklı' : 'Nötr'}
                                                </td>
                                                <td className="border border-gray-200 p-2 text-right font-bold text-red-500">
                                                    {(parseFloat(customer.total_debt) || 0).toFixed(2)} TL
                                                </td>
                                                <td className="border border-gray-200 p-2 text-right font-bold text-green-500">
                                                    {(parseFloat(customer.total_credit) || 0).toFixed(2)} TL
                                                </td>
                                                <td className="border border-gray-200 p-2">{formatDate(customer.last_transaction_date)}</td>
                                                <td className="border border-gray-200 p-2">
                                                    <div className="flex items-center justify-start gap-2">
                                                        <Link
                                                            to={`/customer/${encodeURIComponent(customer.name)}`}
                                                            className="group p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-200"
                                                            title="Detaylar"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </Link>
                                                        <button
                                                            onClick={() => openEditModal(customer)}
                                                            className="group p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md border border-gray-100 hover:border-amber-200"
                                                            title="Düzenle"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(customer.id)}
                                                            className="group p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md border border-gray-100 hover:border-red-200"
                                                            title="Sil"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Modal - 2026 Modern Design */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl my-8">
                        {/* Minimalist Dark Header */}
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-8">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold text-white tracking-tight">Yeni Müşteri Ekle</h2>
                                        <p className="text-slate-400 text-base mt-1">Müşteri bilgilerini doldurun</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-10 space-y-7 overflow-y-auto max-h-[calc(90vh-200px)] bg-gradient-to-b from-slate-50 to-white">
                            {/* Müşteri Adı */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Müşteri Adı <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                    placeholder="Müşteri adını giriniz..."
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Müşteri Kodu */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Müşteri Kodu</label>
                                <input
                                    type="text"
                                    value={formData.customer_code}
                                    onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                                    placeholder="Otomatik üretilir"
                                    className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                                />
                            </div>

                            {/* Firma Bilgileri */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Firma Bilgileri</label>
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                    placeholder="Firma adı..."
                                />
                            </div>

                            {/* Grup ve Durum */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Grubu</label>
                                    <select
                                        value={formData.group}
                                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    >
                                        <option value="Cari">Cari</option>
                                        <option value="Perakende">Perakende</option>
                                        <option value="Firmalar">Firmalar</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Durumu</label>
                                    <select
                                        value={formData.is_active.toString()}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    >
                                        <option value="true">Aktif</option>
                                        <option value="false">Pasif</option>
                                    </select>
                                </div>
                            </div>

                            {/* Adres */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Adres</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    rows="3"
                                    className="w-full px-6 py-5 text-lg rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-slate-400"
                                    placeholder="Adres bilgisi..."
                                />
                            </div>

                            {/* İl ve İlçe */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">İl</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="İl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">İlçe</label>
                                    <input
                                        type="text"
                                        value={formData.district}
                                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="İlçe"
                                    />
                                </div>
                            </div>

                            {/* Vergi Dairesi ve Vergi No */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Vergi Dairesi</label>
                                    <input
                                        type="text"
                                        value={formData.tax_office}
                                        onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Vergi dairesi"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Vergi Numarası</label>
                                    <input
                                        type="text"
                                        value={formData.tax_number}
                                        onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                                        placeholder="11111111111"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-10 py-6 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-5 text-lg font-bold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveNew}
                                className="flex-[2] py-5 text-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            >
                                ✓ Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl my-8">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-8 py-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    Müşteri Düzenle
                                </h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Durumu</label>
                                    <select
                                        value={formData.is_active.toString()}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="true">Aktif</option>
                                        <option value="false">Pasif</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Müşteri Kodu</label>
                                    <input
                                        type="text"
                                        value={formData.customer_code}
                                        onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kısa Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Firma Bilgileri</label>
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Grubu</label>
                                <select
                                    value={formData.group}
                                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                >
                                    <option value="Cari">Cari</option>
                                    <option value="Perakende">Perakende</option>
                                    <option value="Firmalar">Firmalar</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adresi</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">İl</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">İlçe</label>
                                    <input
                                        type="text"
                                        value={formData.district}
                                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Posta Kodu</label>
                                    <input
                                        type="text"
                                        value={formData.zip_code}
                                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ülke</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vergi Dairesi</label>
                                    <input
                                        type="text"
                                        value={formData.tax_office}
                                        onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vergi Numarası</label>
                                    <input
                                        type="text"
                                        value={formData.tax_number}
                                        onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                Güncelle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal - 2026 Modern Design */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        {/* Minimalist Dark Header */}
                        {/* Minimalist Dark Header */}
                        <div className={`px-10 py-8 bg-gradient-to-br ${transactionType === 'payment' ? 'from-slate-900 via-slate-800 to-slate-900' : 'from-orange-600 via-orange-500 to-amber-500'}`}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${transactionType === 'payment' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30' : 'bg-white/20 backdrop-blur-sm shadow-black/10'}`}>
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {transactionType === 'payment' ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            )}
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className={`text-3xl font-bold text-white tracking-tight ${transactionType === 'debt' ? 'animate-pulse' : ''}`}>
                                            {transactionType === 'payment' ? 'Müşteriden Ödeme Al' : 'Firmaya Ödeme Yap'}
                                        </h2>
                                        <p className={`text-base mt-1 ${transactionType === 'payment' ? 'text-slate-200' : 'text-white/90'}`}>
                                            {transactionType === 'payment' ? 'Tahsilat işlemini kaydedin' : 'Firma Carisine Borç Ekleyin'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-10 space-y-8 bg-gradient-to-b from-slate-50 to-white">
                            {/* Müşteri Seç */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-base font-semibold text-slate-700">Müşteri Seç <span className="text-rose-500">*</span></label>
                                    <button
                                        onClick={() => {
                                            setSearchCustomerTerm('');
                                            setShowCustomerSearchModal(true);
                                        }}
                                        className={`text-sm font-bold flex items-center gap-2 transition-colors ${transactionType === 'payment' ? 'text-emerald-600 hover:text-emerald-700' : 'text-orange-600 hover:text-orange-700'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Müşteri Ara
                                    </button>
                                </div>
                                <select
                                    value={paymentData.customer_id}
                                    onChange={(e) => setPaymentData({ ...paymentData, customer_id: e.target.value })}
                                    className={`w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                                >
                                    <option value="">Müşteri seçiniz...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.customer_code ? `(${c.customer_code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Ödeme Tutarı */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Tutar (₺) <span className="text-rose-500">*</span></label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={paymentData.amount}
                                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                                    className={`w-full px-6 py-6 text-3xl font-bold rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all text-center placeholder:text-slate-300 ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Ödeme Yöntemi */}
                            <div className="space-y-3">
                                <label className="block text-base font-semibold text-slate-700">Ödeme Yöntemi</label>
                                <div className="flex gap-4">
                                    {['Nakit', 'Kredi Kartı', 'Havale'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentData({ ...paymentData, payment_type: method })}
                                            className={`flex-1 py-5 px-4 rounded-2xl font-bold text-lg transition-all ${paymentData.payment_type === method
                                                ? (transactionType === 'payment' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30' : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-500/30')
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Açıklama */}
                            <div className="space-y-2">
                                <label className="block text-base font-semibold text-slate-700">Açıklama</label>
                                <input
                                    type="text"
                                    value={paymentData.description}
                                    onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                                    className={`w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 outline-none transition-all placeholder:text-slate-400 ${transactionType === 'payment' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-orange-500/20 focus:border-orange-500'}`}
                                    placeholder={transactionType === 'payment' ? "Örn: Kasım ayı tahsilatı" : "Örn: Firmaya Ödeme Yapıldı"}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-10 py-6 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 py-5 text-lg font-bold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handlePaymentSubmit}
                                className={`flex-[2] py-5 text-xl font-bold text-white rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] ${transactionType === 'payment'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30'
                                    : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/30 animate-pulse'
                                    }`}
                            >
                                {transactionType === 'payment' ? '✓ Ödemeyi Onayla' : '✓ Borcu Onayla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Customer Search Modal */}
            {showCustomerSearchModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-800">Müşteri Ara</h3>
                            <button
                                onClick={() => setShowCustomerSearchModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-5 border-b border-gray-100">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Müşteri adı, vergi no veya kod..."
                                value={searchCustomerTerm}
                                onChange={(e) => setSearchCustomerTerm(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                            {filteredSearchCustomers.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>Müşteri bulunamadı.</p>
                                </div>
                            ) : (
                                filteredSearchCustomers.map(customer => (
                                    <button
                                        key={customer.id}
                                        onClick={() => {
                                            setPaymentData({ ...paymentData, customer_id: customer.id });
                                            setShowCustomerSearchModal(false);
                                        }}
                                        className="w-full text-left p-4 bg-white hover:bg-blue-50 border border-gray-100 rounded-xl transition-all shadow-sm hover:shadow-md flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-bold text-gray-800 group-hover:text-blue-700">{customer.name}</div>
                                            <div className="text-sm text-gray-500 flex gap-3 mt-1">
                                                <span>{customer.customer_code}</span>
                                                {customer.tax_number && (
                                                    <span className="bg-gray-100 px-2 rounded text-xs flex items-center">VN: {customer.tax_number}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${parseFloat(customer.balance) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {parseFloat(customer.balance || 0).toFixed(2)} ₺
                                            </div>
                                            <div className="text-xs text-gray-400">Bakiye</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Excel Import Modal */}
            {showExcelModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-8 py-6">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">Excel İle Cari Yükle</h2>
                                        <p className="text-emerald-100 text-sm mt-0.5">Excel dosyasından toplu müşteri aktarımı</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowExcelModal(false); setExcelFile(null); setExcelPreview([]); }}
                                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Step 1: Download Sample */}
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <span className="text-blue-600 font-bold text-lg">1</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-blue-900">Örnek Excel Dosyasını İndirin</h3>
                                        <p className="text-blue-700 text-sm mt-1">Aşağıdaki örnek dosyayı indirip, müşteri bilgilerinizi doldurun.</p>
                                        <button
                                            onClick={() => {
                                                const headers = ['Müşteri Kodu', 'Müşteri Adı', 'Firma', 'Grubu', 'Durum', 'Adres', 'İl', 'İlçe', 'Vergi Dairesi', 'Vergi No', 'Bakiye (Borç: +, Alacak: -)'];
                                                const sampleRow = ['M0001', 'Ahmet Yılmaz', 'Yılmaz Ticaret', 'Cari', 'Aktif', 'Örnek Mah. Test Cad. No:1', 'İstanbul', 'Kadıköy', 'Kadıköy VD', '1234567890', 1500.50];

                                                const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                                                const wb = XLSX.utils.book_new();
                                                XLSX.utils.book_append_sheet(wb, ws, "Müşteriler");
                                                XLSX.writeFile(wb, "Ornek_Cari_Listesi.xlsx");
                                            }}
                                            className="mt-3 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 w-fit"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Örnek Excel İndir (.xlsx)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Upload File */}
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <span className="text-gray-600 font-bold text-lg">2</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900">Doldurulmuş Dosyayı Yükleyin</h3>
                                        <p className="text-gray-600 text-sm mt-1">Excel (.xlsx veya .xls) formatındaki dosyanızı seçin.</p>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                setExcelFile(file);

                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    try {
                                                        const data = new Uint8Array(ev.target.result);
                                                        const workbook = XLSX.read(data, { type: 'array' });
                                                        const sheetName = workbook.SheetNames[0];
                                                        const worksheet = workbook.Sheets[sheetName];
                                                        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

                                                        if (json.length < 2) { setExcelPreview([]); return; }

                                                        // Assuming fixed column order from template
                                                        const rows = json.slice(1).map(row => {
                                                            return {
                                                                customer_code: row[0] ? String(row[0]).trim() : '',
                                                                name: row[1] ? String(row[1]).trim() : '',
                                                                company: row[2] ? String(row[2]).trim() : '',
                                                                group: row[3] ? String(row[3]).trim() : 'Cari',
                                                                is_active: (String(row[4]) || 'Aktif').toLowerCase() !== 'pasif',
                                                                address: row[5] ? String(row[5]).trim() : '',
                                                                city: row[6] ? String(row[6]).trim() : '',
                                                                district: row[7] ? String(row[7]).trim() : '',
                                                                tax_office: row[8] ? String(row[8]).trim() : '',
                                                                tax_number: row[9] ? String(row[9]).trim() : '',
                                                                initial_balance: row[10] ? parseFloat(String(row[10]).replace(',', '.')) : 0
                                                            };
                                                        }).filter(r => r.name);

                                                        setExcelPreview(rows);
                                                    } catch (error) {
                                                        console.error("Excel parse error:", error);
                                                        alert("Dosya okunamadı. Lütfen geçerli bir Excel dosyası yükleyin.");
                                                        setExcelPreview([]);
                                                    }
                                                };
                                                reader.readAsArrayBuffer(file);
                                            }}
                                            className="mt-3 block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            {excelPreview.length > 0 && (
                                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                                        <span className="font-bold text-gray-700">{excelPreview.length} müşteri yüklenecek</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Kod</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Ad</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Firma</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Grup</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">İl</th>
                                                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500">Açılış Bakiyesi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {excelPreview.map((row, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2 font-mono text-xs">{row.customer_code}</td>
                                                        <td className="px-4 py-2 font-medium">{row.name}</td>
                                                        <td className="px-4 py-2 text-gray-600">{row.company}</td>
                                                        <td className="px-4 py-2 text-gray-600">{row.group}</td>
                                                        <td className="px-4 py-2 text-gray-600">{row.city}</td>
                                                        <td className={`px-4 py-2 text-right font-mono ${row.initial_balance > 0 ? 'text-red-600' : row.initial_balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {row.initial_balance ? `${row.initial_balance} TL` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex gap-4">
                            <button
                                onClick={() => { setShowExcelModal(false); setExcelFile(null); setExcelPreview([]); }}
                                className="flex-1 py-4 text-lg font-bold text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-all"
                            >
                                İptal
                            </button>
                            <button
                                disabled={excelPreview.length === 0 || excelImporting}
                                onClick={async () => {
                                    setExcelImporting(true);
                                    let successCount = 0;
                                    let errorCount = 0;

                                    // Calculate initial next code number
                                    const existingCodes = customers
                                        .map(c => c.customer_code)
                                        .filter(code => code && /^M\d+$/.test(code))
                                        .map(code => parseInt(code.substring(1), 10));
                                    let nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;

                                    for (const row of excelPreview) {
                                        try {
                                            let codeToUse = row.customer_code;

                                            // If manual code provided, check if it updates our high water mark
                                            if (codeToUse && /^M\d+$/.test(codeToUse)) {
                                                const num = parseInt(codeToUse.substring(1), 10);
                                                if (num > nextNum) {
                                                    nextNum = num;
                                                }
                                            }

                                            if (!codeToUse) {
                                                nextNum++;
                                                codeToUse = `M${nextNum.toString().padStart(4, '0')}`;
                                            }

                                            // Check if code already exists in db (basic check against loaded customers)
                                            // Note: concurrency validation should ideally happen on backend
                                            const exists = customers.some(c => c.customer_code === codeToUse);
                                            if (exists && row.customer_code) {
                                                // If code was provided in Excel but exists, maybe let it fail or log
                                            }

                                            await customersAPI.add({ ...row, customer_code: codeToUse });

                                            successCount++;
                                        } catch (err) {
                                            errorCount++;
                                            console.error('Import error:', err);
                                        }
                                    }
                                    setExcelImporting(false);

                                    // Close import modal and show result modal
                                    setShowExcelModal(false);
                                    setExcelFile(null);
                                    setExcelPreview([]);
                                    setImportResult({ show: true, success: successCount, error: errorCount });
                                    loadCustomers();
                                }}
                                className={`flex-[2] py-4 text-lg font-bold text-white rounded-2xl transition-all ${excelPreview.length === 0 || excelImporting
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 hover:scale-[1.01]'
                                    }`}
                            >
                                {excelImporting ? 'Yükleniyor...' : `✓ ${excelPreview.length} Müşteri Yükle`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Result Modal */}
            {importResult.show && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl transform transition-all scale-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>

                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6 animate-bounce-short">
                                <svg className="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            <h3 className="text-2xl font-bold text-gray-900 mb-2">İçe Aktarma Tamamlandı!</h3>
                            <p className="text-gray-500 mb-8">Excel dosyanızdaki müşteri kayıtları başarıyla işlendi.</p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                    <div className="text-3xl font-bold text-emerald-600 mb-1">{importResult.success}</div>
                                    <div className="text-sm font-medium text-emerald-800">Başarılı</div>
                                </div>
                                <div className={`p-4 rounded-2xl border ${importResult.error > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                    <div className={`text-3xl font-bold mb-1 ${importResult.error > 0 ? 'text-red-600' : 'text-gray-400'}`}>{importResult.error}</div>
                                    <div className={`text-sm font-medium ${importResult.error > 0 ? 'text-red-800' : 'text-gray-500'}`}>Hatalı</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setImportResult({ show: false, success: 0, error: 0 })}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-200"
                            >
                                Harika, Devam Et
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
