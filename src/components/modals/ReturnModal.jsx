import React, { useState, useEffect } from 'react';
import { salesAPI } from '../../services/api';

export default function ReturnModal({ isOpen, onClose, onSuccess }) {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState(null);
    const [returnItems, setReturnItems] = useState([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSales();
            setSelectedSale(null);
            setReturnItems([]);
            setSearchQuery('');
        }
    }, [isOpen]);

    const loadSales = async () => {
        setLoading(true);
        try {
            // Fetch last 500 sales to ensure we catch recent returns for validation
            const res = await salesAPI.getAll({ limit: 500 });
            setSales(res.data?.sales || []);
        } catch (error) {
            console.error("Satışlar yüklenirken hata:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaleSelect = (sale) => {
        // 1. Calculate already returned quantities for this sale
        // Find all return records (total < 0) that reference this sale_code in their items
        const returnRecords = sales.filter(s => s.total < 0);
        const returnedQuantities = {};

        returnRecords.forEach(retSale => {
            (retSale.items || []).forEach(item => {
                if (item.original_sale_code === sale.sale_code) {
                    // Match by item ID or Name/Code if IDs are not unique/preserved
                    const key = item.stock_code || item.name;
                    returnedQuantities[key] = (returnedQuantities[key] || 0) + (parseFloat(item.quantity) || 0); // quantity in return record is the returned amount
                }
            });
        });

        // 2. Prepare items
        const items = sale.items ? JSON.parse(JSON.stringify(sale.items)) : [];

        const preparedItems = items.map(item => {
            const key = item.stock_code || item.name;
            const alreadyReturned = returnedQuantities[key] || 0;
            const originalQty = parseFloat(item.quantity) || 0;
            const maxReturnable = Math.max(0, originalQty - alreadyReturned);

            return {
                ...item,
                return_quantity: 0,
                original_quantity: originalQty,
                already_returned: alreadyReturned,
                max_returnable: maxReturnable
            };
        });

        setReturnItems(preparedItems);
        setSelectedSale(sale);
    };

    const handleQuantityChange = (index, value) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return;

        setReturnItems(prev => {
            const newItems = [...prev];
            const item = newItems[index];

            // Validate against max returnable (original - already returned)
            if (val > item.max_returnable) {
                item.return_quantity = item.max_returnable;
            } else {
                item.return_quantity = val;
            }
            return newItems;
        });
    };

    const handleReturnSubmit = async () => {
        const itemsToReturn = returnItems.filter(i => i.return_quantity > 0);
        if (itemsToReturn.length === 0) {
            alert("Lütfen iade edilecek set az bir ürün seçiniz (Miktar > 0).");
            return;
        }

        if (!window.confirm(`${itemsToReturn.length} kalem ürün iade alınacak. Onaylıyor musunuz?`)) return;

        setProcessing(true);
        try {
            await salesAPI.createReturn(selectedSale, itemsToReturn);
            alert("İade işlemi başarıyla tamamlandı.");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("İade hatası:", error);
            alert("İade işlemi başarısız: " + (error.response?.data?.message || error.message));
        } finally {
            setProcessing(false);
        }
    };

    const getSaleReturnStatus = (sale) => {
        // Find all return records for this sale
        const returnRecords = sales.filter(s => s.total < 0);
        let totalOriginalQty = 0;
        let totalReturnedQty = 0;

        // Calculate totals
        if (sale.items) {
            sale.items.forEach(item => {
                totalOriginalQty += parseFloat(item.quantity) || 0;
            });

            // Calculate how much of this sale has been returned
            // We need to look at all return records and sum up quantities for items belonging to this sale
            returnRecords.forEach(retSale => {
                (retSale.items || []).forEach(retItem => {
                    if (retItem.original_sale_code === sale.sale_code) {
                        totalReturnedQty += parseFloat(retItem.quantity) || 0;
                    }
                });
            });
        }

        if (totalReturnedQty >= totalOriginalQty && totalOriginalQty > 0) return 'full';
        if (totalReturnedQty > 0) return 'partial';
        return 'none';
    };

    const filteredSales = sales.filter(s => {
        // Filter out return records (negative total or explicit type)
        if (s.total < 0 || s.payment_method === 'İade') return false;

        const q = searchQuery.toLowerCase();
        return (
            (s.customer || '').toLowerCase().includes(q) ||
            (s.sale_code || '').toLowerCase().includes(q) ||
            (s.items && s.items.some(i => i.name.toLowerCase().includes(q)))
        );
    });

    const calculateRefundTotal = () => {
        return returnItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const qty = parseFloat(item.return_quantity) || 0;
            // Assuming price in sale items is Unit Price (Gross or Net depending on setup, but typically price * qty is total)
            // We use the same calculation formula as SalesPage
            return sum + (price * qty * (1 - discount / 100));
        }, 0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className={`bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${selectedSale ? 'h-[80vh]' : 'max-h-[80vh] h-[70vh]'}`}>

                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined">assignment_return</span>
                            İade İşlemi
                        </h3>
                        <p className="text-red-100 text-sm mt-0.5">
                            {selectedSale
                                ? `#${selectedSale.sale_code} Nolu Satış İadesi `
                                : 'İade yapılacak satışı seçiniz'}
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 rounded-lg p-1.5 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {!selectedSale ? (
                        // SALE SELECTION VIEW
                        <>
                            <div className="p-4 bg-slate-50 border-b border-slate-200">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                                        placeholder="Satış No, Müşteri Adı veya Ürün Ara..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                                {loading ? (
                                    <div className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div></div>
                                ) : filteredSales.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10">
                                        <span className="material-symbols-outlined text-4xl mb-2">find_in_page</span>
                                        <p>Eşleşen satış bulunamadı.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredSales.map(sale => {
                                            const returnStatus = getSaleReturnStatus(sale);
                                            return (
                                                <div
                                                    key={sale.id}
                                                    onClick={() => handleSaleSelect(sale)}
                                                    className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-red-400 hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-800">{sale.customer || 'Misafir'}</h4>
                                                                {returnStatus === 'full' && (
                                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200 uppercase">
                                                                        Tamamı İade Edilmiştir
                                                                    </span>
                                                                )}
                                                                {returnStatus === 'partial' && (
                                                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-200 uppercase">
                                                                        Bu işlemde kısmi iade yapılmıştır
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-slate-500 font-mono tracking-wider">{sale.created_at ? new Date(sale.created_at).toLocaleString('tr-TR') : '-'}</span>
                                                        </div>
                                                        <span className="font-black text-lg text-slate-700">{sale.total?.toFixed(2)} ₺</span>
                                                    </div>
                                                    <div className="flex gap-2 text-xs text-slate-500 overflow-hidden whitespace-nowrap mask-linear-fade">
                                                        {(sale.items || []).map(i => i.name).join(', ')}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        // DETAIL / ITEM SELECTION VIEW
                        <div className="flex flex-col h-full">
                            <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex justify-between items-center">
                                <button
                                    onClick={() => setSelectedSale(null)}
                                    className="text-red-700 font-bold flex items-center gap-1 hover:underline text-sm"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    Listeye Dön
                                </button>
                                <div className="text-right">
                                    <span className="text-xs text-red-600 font-bold uppercase tracking-wider block">Müşteri</span>
                                    <span className="font-bold text-slate-800">{selectedSale.customerData?.name || selectedSale.customer || 'Misafir'}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 border-b border-slate-200">Ürün</th>
                                            <th className="px-4 py-3 border-b border-slate-200 text-center">Satılan</th>
                                            <th className="px-4 py-3 border-b border-slate-200 text-center bg-green-100 text-green-800 border-green-200">İade Edilen</th>
                                            <th className="px-4 py-3 border-b border-slate-200 text-center bg-yellow-100 text-yellow-800 border-yellow-200">Kalan</th>
                                            <th className="px-4 py-3 border-b border-slate-200 text-center">Fiyat</th>
                                            <th className="px-4 py-3 border-b border-slate-200 text-center bg-red-50 text-red-700 border-red-100">İade Adet</th>
                                            <th className="px-6 py-3 border-b border-slate-200 text-right">İade Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {returnItems.map((item, idx) => {
                                            const unitPrice = item.price * (1 - (item.discount_rate || 0) / 100);
                                            const lineRefund = unitPrice * (item.return_quantity || 0);
                                            const isFullyReturned = item.max_returnable <= 0 && item.original_quantity > 0;

                                            return (
                                                <tr key={idx} className={`relative hover:bg-slate-50 transition-colors ${item.return_quantity > 0 ? 'bg-red-50/30' : ''} ${isFullyReturned ? 'bg-slate-50/50' : ''}`}>
                                                    <td className="px-6 py-3">
                                                        <p className={`font-bold text-sm line-clamp-1 ${isFullyReturned ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.name}</p>
                                                        <p className="text-xs text-slate-400">{item.stock_code}</p>
                                                        {isFullyReturned && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                                                <span className="text-red-500/20 font-black text-4xl uppercase -rotate-12 select-none whitespace-nowrap">
                                                                    DAHA ÖNCE İADESİ YAPILMIŞTIR
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-600 font-medium">
                                                        {item.original_quantity}
                                                    </td>
                                                    <td className="px-4 py-3 text-center bg-green-50 text-green-900 font-bold border-x border-slate-100">
                                                        {item.already_returned}
                                                    </td>
                                                    <td className="px-4 py-3 text-center bg-yellow-50 text-yellow-900 font-black text-lg border-x border-slate-100">
                                                        {item.max_returnable}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-600">
                                                        {unitPrice.toFixed(2)} ₺
                                                    </td>
                                                    <td className="px-4 py-3 text-center bg-red-50/50">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleQuantityChange(idx, (item.return_quantity || 0) - 1)}
                                                                className="w-6 h-6 rounded bg-white border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50"
                                                                disabled={item.return_quantity <= 0 || isFullyReturned}
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={item.max_returnable}
                                                                value={item.return_quantity}
                                                                onChange={e => handleQuantityChange(idx, e.target.value)}
                                                                disabled={isFullyReturned}
                                                                className="w-12 text-center font-bold text-red-700 bg-transparent border-b border-red-300 focus:border-red-600 outline-none p-1 disabled:opacity-50"
                                                            />
                                                            <button
                                                                onClick={() => handleQuantityChange(idx, (item.return_quantity || 0) + 1)}
                                                                className="w-6 h-6 rounded bg-white border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50"
                                                                disabled={item.return_quantity >= item.max_returnable || isFullyReturned}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-bold text-red-600">
                                                        {lineRefund > 0 ? `-${lineRefund.toFixed(2)} ₺` : '0.00 ₺'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-20">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">TOPLAM İADE TUTARI</p>
                                        <p className="text-3xl font-black text-red-600">-{calculateRefundTotal().toFixed(2)} ₺</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelectedSale(null)}
                                            className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={handleReturnSubmit}
                                            disabled={processing || calculateRefundTotal() === 0}
                                            className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                                        >
                                            {processing ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    İşleniyor...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                    İadeyi Tamamla
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
