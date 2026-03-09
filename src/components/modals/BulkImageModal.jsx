import { useState, useRef } from 'react';
import { productsAPI } from '../../services/api';

export default function BulkImageModal({ isOpen, onClose, products }) {
    const [rows, setRows] = useState(() =>
        Array(6).fill(null).map(() => ({ product: null, status: null }))
    );

    const updateRow = (index, data) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], ...data };
        setRows(newRows);
    };

    const deleteRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const handleProductSelect = (index, stockCode) => {
        if (!stockCode) {
            updateRow(index, { product: null, status: null });
            return;
        }
        const product = products.find(p => p.stock_code === stockCode);
        if (product) {
            updateRow(index, { product, status: 'waiting' });
        }
    };

    const handleFileSelect = async (index, file) => {
        if (!file || !rows[index].product) return;

        const row = rows[index];
        updateRow(index, { status: 'uploading' });

        const formData = new FormData();
        formData.append('product_image', file);

        try {
            await productsAPI.updateImage(row.product.stock_code, formData);
            updateRow(index, { status: 'success' });
        } catch (error) {
            console.error(error);
            updateRow(index, { status: 'error' });
        }
    };

    if (!isOpen) return null;

    const successCount = rows.filter(r => r.status === 'success').length;
    const totalWithProduct = rows.filter(r => r.product).length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-8 py-6 flex-shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                Toplu Ürün Resmi Güncelleme
                            </h2>
                            <p className="text-white/80 mt-2 text-sm">Birden fazla ürün resmini aynı anda güncelleyin</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Stats */}
                    {totalWithProduct > 0 && (
                        <div className="mt-4 flex gap-4">
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                                <span className="text-white/70 text-sm">Seçilen:</span>
                                <span className="text-white font-bold ml-2">{totalWithProduct}</span>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                                <span className="text-white/70 text-sm">Yüklenen:</span>
                                <span className="text-white font-bold ml-2">{successCount}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-8 py-3 flex items-center gap-3 flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-blue-800 text-sm">
                        Her satır için bir ürün seçin ve resmi yükleyin. İşlemler anında sunucuya kaydedilir.
                    </p>
                </div>

                {/* Rows Container */}
                <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50 to-emerald-50/30">
                    <div className="space-y-3">
                        {rows.map((row, index) => (
                            <RowItem
                                key={index}
                                index={index}
                                row={row}
                                products={products}
                                onProductSelect={handleProductSelect}
                                onFileSelect={handleFileSelect}
                                onDelete={() => deleteRow(index)}
                            />
                        ))}

                        <button
                            onClick={() => setRows([...rows, { product: null, status: null }])}
                            className="w-full py-4 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-2xl hover:bg-emerald-50 hover:border-emerald-400 transition-all flex items-center justify-center gap-2 font-semibold"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Satır Ekle
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-5 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                    <p className="text-gray-500 text-sm">
                        {successCount > 0 && `${successCount} resim başarıyla yüklendi`}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
}

function RowItem({ index, row, products, onProductSelect, onFileSelect, onDelete }) {
    const fileInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const filtered = searchTerm ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.stock_code.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 8) : [];

    const getStatusBadge = () => {
        if (!row.product) return null;

        switch (row.status) {
            case 'success':
                return (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-semibold">Yüklendi!</span>
                    </div>
                );
            case 'uploading':
                return (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="font-semibold">Yükleniyor...</span>
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="font-semibold">Hata!</span>
                    </div>
                );
            default:
                return (
                    <div className="text-gray-400 text-sm">Resim yüklenmeye hazır</div>
                );
        }
    };

    return (
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            {/* Index */}
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold">
                {index + 1}
            </div>

            {/* Product Select */}
            <div className="flex-1 relative">
                {!row.product ? (
                    <div className="relative">
                        <button
                            onClick={() => setIsSearching(true)}
                            className="w-full text-left px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all flex justify-between items-center shadow-lg shadow-green-500/25"
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Ürün Seç
                            </span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isSearching && (
                            <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-2xl rounded-2xl mt-2 z-20 overflow-hidden">
                                <div className="p-3 border-b border-gray-100">
                                    <input
                                        autoFocus
                                        placeholder="Ürün adı veya stok kodu ara..."
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {filtered.map(p => (
                                        <div
                                            key={p.stock_code}
                                            className="px-4 py-3 hover:bg-emerald-50 cursor-pointer flex items-center gap-3 transition-colors"
                                            onClick={() => {
                                                onProductSelect(index, p.stock_code);
                                                setIsSearching(false);
                                                setSearchTerm('');
                                            }}
                                        >
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                {p.image_url ? (
                                                    <img src={p.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                                                <p className="text-sm text-emerald-600 font-mono">{p.stock_code}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {filtered.length === 0 && searchTerm && (
                                        <div className="px-4 py-8 text-center text-gray-400">
                                            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Ürün bulunamadı
                                        </div>
                                    )}
                                    {!searchTerm && (
                                        <div className="px-4 py-6 text-center text-gray-400 text-sm">
                                            Aramak için yazmaya başlayın...
                                        </div>
                                    )}
                                </div>
                                <div
                                    className="p-3 border-t border-gray-100 text-center text-sm text-gray-500 hover:text-red-500 cursor-pointer transition-colors"
                                    onClick={() => { setIsSearching(false); setSearchTerm(''); }}
                                >
                                    Kapat
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-emerald-50/50 px-4 py-3 rounded-xl border border-gray-200">
                        <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                            {row.product.image_url ? (
                                <img src={row.product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{row.product.name}</p>
                            <p className="text-sm text-emerald-600 font-mono">{row.product.stock_code}</p>
                        </div>
                        <button
                            onClick={() => onProductSelect(index, null)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="w-40 flex justify-center">
                {row.product ? getStatusBadge() : (
                    <span className="text-gray-400 text-sm italic">Ürün seçilmedi</span>
                )}
            </div>

            {/* Upload Button */}
            <div className="w-36">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => onFileSelect(index, e.target.files[0])}
                    hidden
                    accept="image/*"
                />
                <button
                    onClick={() => fileInputRef.current.click()}
                    disabled={!row.product || row.status === 'uploading'}
                    className={`w-full py-3 px-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${!row.product
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : row.status === 'uploading'
                            ? 'bg-blue-100 text-blue-500 cursor-wait'
                            : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:-translate-y-0.5'
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Yükle
                </button>
            </div>

            {/* Delete Row */}
            <button
                onClick={onDelete}
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    );
}
