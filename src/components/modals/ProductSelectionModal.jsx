import React from 'react';

export default function ProductSelectionModal({ isOpen, onClose, products, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined">dataset</span>
                            Ürün Seçimi
                        </h3>
                        <p className="text-orange-100 text-sm mt-0.5">Birden fazla ürün bulundu, lütfen seçiniz.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                    {products.map((product) => (
                        <div
                            key={product.id || product.stock_code}
                            onClick={() => onSelect(product)}
                            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-orange-500 hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                                            {product.stock_code || 'KOD YOK'}
                                        </span>
                                        {product.barcode && (
                                            <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">barcode_scanner</span>
                                                {product.barcode}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-lg group-hover:text-orange-600 transition-colors">
                                        {product.name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                                            <span>Stok: {product.stock || 0}</span>
                                        </div>
                                        {product.brand && (
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[16px]">branding_watermark</span>
                                                <span>{product.brand}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-black text-emerald-600">
                                        {product.price?.toFixed(2)} ₺
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 shrink-0 text-right">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        İptal
                    </button>
                </div>
            </div>
        </div>
    );
}
