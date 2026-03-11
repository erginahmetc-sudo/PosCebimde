import { useState, useEffect, useRef } from 'react';
import * as xlsx from 'xlsx';
import { productsAPI } from '../services/api';
import ExcelImportModal from '../components/modals/ExcelImportModal';
import BulkImageModal from '../components/modals/BulkImageModal';
import LabelPrintModal from '../components/modals/LabelPrintModal';

export default function ProductsPage() {
    // State for Filter/Sort/Data
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });

    // Sidebar Context (Global Navigation)
    // Local Filter Sidebar State (Mobile Only)
    const [filterOpen, setFilterOpen] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        stockCode: '',
        barcode: '',
        brand: '',
        group: '',
        priceMin: '',
        priceMax: '',
        displayLimit: '100'
    });

    // Sort state
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const [formData, setFormData] = useState({
        name: '',
        stock_code: '',
        barcode: '',
        price: '',
        stock: '',
        group: '',
        brand: '',
    });

    // Modal States
    const [excelModalOpen, setExcelModalOpen] = useState(false);
    const [excelModalType, setExcelModalType] = useState('new'); // 'new' or 'update'
    const [bulkImageModalOpen, setBulkImageModalOpen] = useState(false);
    const [labelPrintModalOpen, setLabelPrintModalOpen] = useState(false);

    // Handlers
    const openExcelNew = () => {
        setExcelModalType('new');
        setExcelModalOpen(true);
    };

    const openExcelUpdate = () => {
        setExcelModalType('update');
        setExcelModalOpen(true);
    };

    const exportToExcel = () => {
        const exportData = products.map(p => ({
            'Stok Kodu': p.stock_code || '',
            'Barkod': p.barcode || '',
            'Ürün Adı': p.name || '',
            'Marka': p.brand || '',
            'Grup': p.group || '',
            'Stok': p.stock || 0,
            'Fiyat': p.price || 0
        }));

        const ws = xlsx.utils.json_to_sheet(exportData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Ürünler');
        xlsx.writeFile(wb, `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            setProducts(response.data?.products || []);
        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    // Normalize Turkish characters for search
    const normalizeText = (text) => {
        if (typeof text !== 'string') return '';
        return text
            .toLowerCase()
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c');
    };

    // Filter and sort products
    const getFilteredProducts = () => {
        let filtered = [...products];

        // Apply filters
        if (filters.name) {
            const term = normalizeText(filters.name);
            filtered = filtered.filter(p => normalizeText(p.name).includes(term));
        }
        if (filters.stockCode) {
            const term = normalizeText(filters.stockCode);
            filtered = filtered.filter(p => normalizeText(p.stock_code).includes(term));
        }
        if (filters.barcode) {
            const term = normalizeText(filters.barcode);
            filtered = filtered.filter(p => normalizeText(p.barcode).includes(term));
        }
        if (filters.brand) {
            const term = normalizeText(filters.brand);
            filtered = filtered.filter(p => normalizeText(p.brand).includes(term));
        }
        if (filters.group) {
            const term = normalizeText(filters.group);
            filtered = filtered.filter(p => normalizeText(p.group).includes(term));
        }
        if (filters.priceMin) {
            const min = parseFloat(filters.priceMin);
            if (!isNaN(min)) filtered = filtered.filter(p => p.price >= min);
        }
        if (filters.priceMax) {
            const max = parseFloat(filters.priceMax);
            if (!isNaN(max)) filtered = filtered.filter(p => p.price <= max);
        }

        // Sort
        filtered.sort((a, b) => {
            const key = sortConfig.key;
            if (a[key] == null || b[key] == null) return 0;

            if (key === 'stock' || key === 'price') {
                const valA = parseFloat(a[key]) || 0;
                const valB = parseFloat(b[key]) || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }

            const comparison = String(a[key]).toLowerCase().localeCompare(String(b[key]).toLowerCase(), 'tr');
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        // Apply limit
        if (filters.displayLimit !== 'all') {
            const limit = parseInt(filters.displayLimit);
            return { products: filtered.slice(0, limit), total: filtered.length };
        }
        return { products: filtered, total: filtered.length };
    };

    const { products: filteredProducts, total: totalFiltered } = getFilteredProducts();

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const clearFilters = () => {
        setFilters({
            name: '',
            stockCode: '',
            barcode: '',
            brand: '',
            group: '',
            priceMin: '',
            priceMax: '',
            displayLimit: '100'
        });
    };

    const generateStockCode = () => {
        // Use random 6 digits to generate a unique code and avoid conflicts with deleted items in DB
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const code = `STK-${randomNum}`;
        return code;
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setFormData({
            name: '',
            stock_code: generateStockCode(),
            barcode: '',
            price: '',
            stock: '',
            group: '',
            brand: '',
        });
        setShowModal(true);
    };

    const openEditModal = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name || '',
            stock_code: product.stock_code || '',
            barcode: product.barcode || '',
            price: product.price?.toString() || '',
            stock: product.stock?.toString() || '',
            group: product.group || '',
            brand: product.brand || '',
        });
        setShowModal(true);
    };

    const openImageModal = (product) => {
        setEditingProduct(product);
        setShowImageModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                price: parseFloat(formData.price) || 0,
                stock: parseInt(formData.stock) || 0,
            };

            if (editingProduct) {
                await productsAPI.update(editingProduct.stock_code, data);
            } else {
                await productsAPI.add(data);
            }

            setShowModal(false);
            loadProducts();
        } catch (error) {
            const msg = error.response?.data?.message || error.message || '';
            // Check for both old and new constraint names
            if (msg.includes('products_stock_code') && msg.includes('unique')) {
                setErrorModal({
                    show: true,
                    title: '⚠️ Stok Kodu Kullanımda',
                    message: `"${formData.stock_code}" stok kodu sistemde zaten kayıtlıdır. Lütfen farklı bir stok kodu giriniz.`
                });
            } else {
                setErrorModal({
                    show: true,
                    title: '❌ Hata Oluştu',
                    message: msg || 'Bilinmeyen bir hata oluştu.'
                });
            }
        }
    };

    const handleDelete = async (stockCode) => {
        if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;
        try {
            await productsAPI.delete(stockCode);
            loadProducts();
        } catch (error) {
            alert('Silme hatası: ' + (error.response?.data?.message || error.message));
        }
    };

    const [loadingModal, setLoadingModal] = useState({ show: false, message: '' });

    const handleImageUpload = async () => {
        if (!selectedImage) {
            setErrorModal({ show: true, title: 'Uyarı', message: '⚠️ Lütfen önce bir resim seçiniz! (Dosya algılanmadı)' });
            return;
        }

        setLoadingModal({ show: true, message: 'Resim yükleniyor...' });

        const formData = new FormData();
        formData.append('product_image', selectedImage);

        try {
            await productsAPI.updateImage(editingProduct.stock_code, formData);
            // Artificial delay to let user see the loading state (optional but good for UX)
            await new Promise(resolve => setTimeout(resolve, 800));

            setLoadingModal({ show: false, message: '' });
            setShowImageModal(false);
            setSelectedImage(null); // Reset
            loadProducts();

            // Optional: Show quick success toast if needed, but the modal closing is often enough
        } catch (error) {
            console.error(error);
            setLoadingModal({ show: false, message: '' });
            setErrorModal({
                show: true,
                title: 'Yükleme Hatası',
                message: 'Resim yüklenirken bir hata oluştu: ' + (error.response?.data?.message || error.message)
            });
        }
    };

    const getStockClass = (stock) => {
        const stockNum = parseInt(stock) || 0;
        if (stockNum <= 0) return 'text-red-600 font-bold';
        if (stockNum < 10) return 'text-amber-600 font-bold';
        return 'text-gray-800';
    };



    return (
        <div className="flex min-h-screen transition-all duration-300 relative">

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
            {/* Sidebar Overlay (Mobile) */}
            {filterOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setFilterOpen(false)}
                />
            )}

            {/* Filter Sidebar */}
            <aside className={`
                fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50
                w-72 bg-white/90 backdrop-blur-2xl border-r border-slate-200/60 p-5 overflow-y-auto
                transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) text-slate-700
                ${filterOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
            `}>
                <div className="flex items-center justify-between mb-6 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Filtreleme</h3>
                    </div>

                    <button
                        onClick={() => setFilterOpen(false)}
                        className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Ürün Adı</label>
                        <input
                            type="text"
                            value={filters.name}
                            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                            placeholder="Ürün ara..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                        />
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Stok Kodu</label>
                        <input
                            type="text"
                            value={filters.stockCode}
                            onChange={(e) => setFilters({ ...filters, stockCode: e.target.value })}
                            placeholder="Stok kodu ara..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                        />
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Barkod</label>
                        <input
                            type="text"
                            value={filters.barcode}
                            onChange={(e) => setFilters({ ...filters, barcode: e.target.value })}
                            placeholder="Barkod ara..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="group">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Marka</label>
                            <input
                                type="text"
                                value={filters.brand}
                                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                                placeholder="Marka"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                            />
                        </div>
                        <div className="group">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Grup</label>
                            <input
                                type="text"
                                value={filters.group}
                                onChange={(e) => setFilters({ ...filters, group: e.target.value })}
                                placeholder="Grup"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fiyat Aralığı (TL)</label>
                        <div className="flex flex-col gap-2">
                            <input
                                type="number"
                                value={filters.priceMin}
                                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                                placeholder="Min"
                                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm transition-all text-center font-medium text-slate-700 placeholder:text-slate-400"
                            />
                            <input
                                type="number"
                                value={filters.priceMax}
                                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                                placeholder="Max"
                                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm transition-all text-center font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Limit</label>
                        <select
                            value={filters.displayLimit}
                            onChange={(e) => setFilters({ ...filters, displayLimit: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 text-sm cursor-pointer"
                        >
                            <option value="50">50 Urun Goster</option>
                            <option value="100">100 Urun Goster</option>
                            <option value="1000">1000 Urun Goster</option>
                            <option value="all">Hepsini Goster</option>
                        </select>
                    </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                    <button
                        onClick={clearFilters}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-300/50 hover:bg-slate-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 group"
                    >
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Temizle
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        {/* Title Area */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setFilterOpen(true)}
                                className="lg:hidden p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                                    Ürün Yönetimi
                                </h1>
                                <p className="text-gray-500 mt-1 flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                                        {totalFiltered}
                                    </span>
                                    ürün kayıtlı
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={exportToExcel}
                                className="group px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Excel Dışarı Aktar
                            </button>
                            <button
                                onClick={openExcelNew}
                                className="group px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Excel İle Yeni Ürün Ekle
                            </button>
                            <button
                                onClick={openExcelUpdate}
                                className="group px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Excel İle Ürün Güncelle
                            </button>
                            <button
                                onClick={() => setBulkImageModalOpen(true)}
                                className="group px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Toplu Resim Güncelle
                            </button>
                            <button
                                onClick={() => setLabelPrintModalOpen(true)}
                                className="group px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                Etiket Yazdır
                            </button>
                            <button
                                onClick={openAddModal}
                                className="px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-900/25 hover:shadow-xl hover:shadow-gray-900/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
                            >
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Yeni Ürün Ekle
                            </button>
                        </div>
                    </div>
                </div>


                {/* Product Table */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100/80 shadow-xl shadow-gray-200/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-100">
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Resim</th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('stock_code')}>
                                        <span className="flex items-center gap-1">Stok Kodu {getSortIcon('stock_code')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Barkod</th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('name')}>
                                        <span className="flex items-center gap-1">Ürün Adı {getSortIcon('name')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('brand')}>
                                        <span className="flex items-center gap-1">Marka {getSortIcon('brand')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('group')}>
                                        <span className="flex items-center gap-1">Grup {getSortIcon('group')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('stock')}>
                                        <span className="flex items-center gap-1">Stok {getSortIcon('stock')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('price')}>
                                        <span className="flex items-center gap-1">Fiyat {getSortIcon('price')}</span>
                                    </th>
                                    <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredProducts.map((product, index) => (
                                    <tr key={product.stock_code} className={`group hover:bg-blue-50/50 transition-all duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                        <td className="px-5 py-4">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="w-12 h-12 object-contain rounded-xl border-2 border-gray-100 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all" />
                                            ) : (
                                                <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-mono text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{product.stock_code}</span>
                                        </td>
                                        <td className="px-5 py-4 font-mono text-sm text-gray-500">{product.barcode || '-'}</td>
                                        <td className="px-5 py-4">
                                            <span className="font-medium text-gray-900">{product.name}</span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600">{product.brand || '-'}</td>
                                        <td className="px-5 py-4">
                                            {product.group && (
                                                <span className="px-2.5 py-1 bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200/50">
                                                    {product.group}
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-5 py-4 font-bold ${getStockClass(product.stock)}`}>
                                            {product.stock}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-bold text-gray-900">
                                                ₺{parseFloat(product.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openImageModal(product)}
                                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all hover:scale-110"
                                                    title="Resim Yükle"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-all hover:scale-110"
                                                    title="Düzenle"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.stock_code)}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all hover:scale-110"
                                                    title="Sil"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="text-center py-16">
                                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-gray-500 text-lg font-medium">Henüz ürün yok</p>
                                <p className="text-gray-400 text-sm mt-1">İlk ürününüzü eklemek için "Yeni Ürün" butonuna tıklayın</p>
                            </div>
                        )}
                    </div>
                </div>
            </main >

            {/* Add/Edit Product Modal ... (omitted for brevity, assume same as before) */}
            {/* ... */}
            {/* Same modals as before - I will output the file again, so just need to make sure I finish the Component properly */}

            {/* Add/Edit Modal - 2026 Modern Design */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
                            {/* Minimalist Dark Header */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-10 py-8">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {editingProduct ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                )}
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
                                            </h2>
                                            <p className="text-slate-400 text-base mt-1">Ürün bilgilerini doldurun</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                                    >
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[calc(90vh-140px)] bg-gradient-to-b from-slate-50 to-white">
                                {/* Ürün Adı - Full Width */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Ürün Adı <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ürün adını giriniz..."
                                        required
                                        autoFocus
                                    />
                                </div>

                                {/* Stok Kodu */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Stok Kodu <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.stock_code}
                                        onChange={(e) => setFormData({ ...formData, stock_code: e.target.value })}
                                        className={`w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono ${editingProduct ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                        placeholder="STK-001"
                                        required
                                        disabled={!!editingProduct}
                                    />
                                </div>

                                {/* Barkod */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Barkod</label>
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                                        placeholder="8690123456789"
                                    />
                                </div>

                                {/* Fiyat */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Fiyat (₺) <span className="text-rose-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-6 py-5 text-2xl font-bold rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>

                                {/* Stok Miktarı */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Stok Miktarı</label>
                                    <input
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="0"
                                    />
                                </div>

                                {/* Marka */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Marka</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Marka adı..."
                                    />
                                </div>

                                {/* Grup */}
                                <div className="space-y-2">
                                    <label className="block text-base font-semibold text-slate-700">Grup</label>
                                    <input
                                        type="text"
                                        value={formData.group}
                                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                        className="w-full px-6 py-5 text-xl rounded-2xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ürün grubu..."
                                    />
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-4 pt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-5 text-lg font-bold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-5 text-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        ✓ {editingProduct ? 'Güncelle' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Image Modal */}
            {
                showImageModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">🖼️ Resim Güncelle</h2>
                            <div className="space-y-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setSelectedImage(e.target.files[0])}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                <div className="text-xs text-center text-gray-400">
                                    {selectedImage ? `✅ Seçilen: ${selectedImage.name}` : '❌ Dosya seçilmedi'}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowImageModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleImageUpload}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        Yükle
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* New Advanced Modals */}
            <ExcelImportModal
                isOpen={excelModalOpen}
                onClose={() => setExcelModalOpen(false)}
                type={excelModalType}
                onSuccess={loadProducts}
            />

            <BulkImageModal
                isOpen={bulkImageModalOpen}
                onClose={() => setBulkImageModalOpen(false)}
                products={products}
            />

            <LabelPrintModal
                isOpen={labelPrintModalOpen}
                onClose={() => setLabelPrintModalOpen(false)}
                products={products}
            />

            {/* Modern Error Modal */}
            {errorModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">{errorModal.title}</h3>
                        </div>
                        {/* Body */}
                        <div className="p-6">
                            <p className="text-gray-700 text-base leading-relaxed">{errorModal.message}</p>
                        </div>
                        {/* Footer */}
                        <div className="px-6 pb-6">
                            <button
                                onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                                className="w-full py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold rounded-xl transition-all shadow-lg"
                            >
                                Tamam
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modern Loading Modal */}
            {loadingModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Lütfen Bekleyin</h3>
                        <p className="text-gray-500 font-medium text-center animate-pulse">{loadingModal.message}</p>
                    </div>
                </div>
            )}

        </div >

    );
}
