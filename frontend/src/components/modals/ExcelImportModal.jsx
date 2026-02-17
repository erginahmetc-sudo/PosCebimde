/* eslint-disable react/prop-types */
import { useState, useRef, useCallback } from 'react';
import * as xlsx from 'xlsx';
import { productsAPI } from '../../services/api';

export default function ExcelImportModal({ isOpen, onClose, type = 'new', onSuccess }) {
    const [step, setStep] = useState('config'); // config | preview | processing | result
    const [mappingKey, setMappingKey] = useState('stock_code');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [previewRows, setPreviewRows] = useState([]);
    const [allRows, setAllRows] = useState([]);
    const [importResult, setImportResult] = useState(null);

    const [columns, setColumns] = useState({
        name: true,
        price: true,
        barcode: true,
        group: true,
        brand: true
    });

    const fileInputRef = useRef(null);

    // Reset all state when closing
    const handleClose = useCallback(() => {
        setStep('config');
        setMappingKey('stock_code');
        setLoading(false);
        setProgress(0);
        setProgressStatus('');
        setDragActive(false);
        setPreviewRows([]);
        setAllRows([]);
        setImportResult(null);
        setColumns({ name: true, price: true, barcode: true, group: true, brand: true });
        if (fileInputRef.current) fileInputRef.current.value = null;
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    const title = type === 'new' ? 'Excel İle Yeni Ürün Yükle' : 'Excel İle Ürün Güncelle';
    const subtitle = type === 'new'
        ? 'Excel dosyanızdan yeni ürünler ekleyin'
        : 'Mevcut ürünlerinizi Excel ile güncelleyin';

    const downloadSampleExcel = () => {
        const headers = ['Stok Kodu', 'Ürün Adı', 'Fiyat', 'Barkod', 'Grup', 'Marka'];
        const sampleRow = ['STK-0001', 'Örnek Ürün', 100, '8690000000001', 'Genel', 'Markasız'];
        const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Urunler");
        ws['!cols'] = headers.map(h => ({ wch: h.length + 5 }));
        xlsx.writeFile(wb, "Ornek_Urun_Listesi.xlsx");
    };

    // Step 1: Read file and show preview
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('Excel dosyası boş veya yalnızca başlık satırı içeriyor.');
                return;
            }

            const rows = jsonData.slice(1).filter(row => {
                const keyVal = row[0]?.toString().trim();
                return !!keyVal; // filter empty key rows
            });

            if (rows.length === 0) {
                alert('Excel dosyasında geçerli satır bulunamadı. A sütunu (Stok Kodu/Barkod) boş olamaz.');
                return;
            }

            setAllRows(rows);
            setPreviewRows(rows.slice(0, 10)); // first 10 for preview
            setStep('preview');
        } catch (error) {
            alert('Dosya okuma hatası: ' + error.message);
        } finally {
            if (e.target?.value) e.target.value = null;
        }
    };

    // Step 2: Process all rows
    const handleStartImport = async () => {
        setStep('processing');
        setLoading(true);
        setProgress(0);

        let successCount = 0;
        let errors = [];
        let skippedDuplicates = [];
        let emptyRows = 0;

        try {
            const { data: { products: currentProducts } } = await productsAPI.getAll();
            const totalRows = allRows.length;

            for (let i = 0; i < totalRows; i++) {
                const row = allRows[i];

                // Progress
                const currentProgress = Math.round(((i + 1) / totalRows) * 100);
                setProgress(currentProgress);
                setProgressStatus(`${i + 1} / ${totalRows} ürün işleniyor...`);
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));

                const keyVal = row[0]?.toString().trim();
                if (!keyVal) { emptyRows++; continue; }

                const rowData = {
                    name: row[1]?.toString().trim(),
                    price: row[2],
                    barcode: row[3]?.toString().trim(),
                    group: row[4]?.toString().trim(),
                    brand: row[5]?.toString().trim(),
                };

                if (type === 'new') {
                    // Duplicate check: stock_code
                    const existingByStockCode = currentProducts.find(p => p.stock_code === keyVal);
                    if (existingByStockCode) {
                        skippedDuplicates.push(`Satır ${i + 2}: Stok Kodu (${keyVal}) zaten mevcut → "${existingByStockCode.name}"`);
                        continue;
                    }
                    // Duplicate check: barcode
                    if (rowData.barcode) {
                        const existingByBarcode = currentProducts.find(p => p.barcode === rowData.barcode);
                        if (existingByBarcode) {
                            skippedDuplicates.push(`Satır ${i + 2}: Barkod (${rowData.barcode}) zaten mevcut → "${existingByBarcode.name}"`);
                            continue;
                        }
                    }

                    const newProduct = {
                        stock_code: keyVal,
                        name: rowData.name || 'Adsız',
                        price: parseFloat(rowData.price) || 0,
                        barcode: rowData.barcode || '',
                        group: rowData.group || '',
                        brand: rowData.brand || '',
                        stock: 0
                    };
                    try {
                        await productsAPI.add(newProduct);
                        successCount++;
                        currentProducts.push(newProduct);
                    } catch (err) {
                        errors.push(`Satır ${i + 2} (${keyVal}): ${err.message || 'Eklenemedi'}`);
                    }

                } else {
                    // Update mode
                    const existing = currentProducts.find(p =>
                        mappingKey === 'stock_code' ? p.stock_code === keyVal : p.barcode === keyVal
                    );

                    if (!existing) {
                        errors.push(`Satır ${i + 2}: "${keyVal}" ile eşleşen ürün bulunamadı`);
                        continue;
                    }

                    const updates = {};
                    if (columns.name && rowData.name) updates.name = rowData.name;
                    if (columns.price && rowData.price != null) {
                        const parsed = parseFloat(rowData.price);
                        if (!isNaN(parsed)) updates.price = parsed;
                    }
                    if (columns.barcode && rowData.barcode) updates.barcode = rowData.barcode;
                    if (columns.group && rowData.group) updates.group = rowData.group;
                    if (columns.brand && rowData.brand) updates.brand = rowData.brand;

                    if (Object.keys(updates).length === 0) {
                        skippedDuplicates.push(`Satır ${i + 2} (${keyVal}): Güncellenecek alan bulunamadı`);
                        continue;
                    }

                    try {
                        await productsAPI.update(existing.stock_code, updates);
                        successCount++;
                    } catch (err) {
                        errors.push(`Satır ${i + 2} (${keyVal}): ${err.message || 'Güncellenemedi'}`);
                    }
                }
            }

            setImportResult({
                success: successCount,
                duplicates: skippedDuplicates,
                errors,
                empty: emptyRows,
                total: totalRows
            });
            setStep('result');
            onSuccess();

        } catch (error) {
            alert('İşlem hatası: ' + error.message);
            setStep('config');
        } finally {
            setLoading(false);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFileSelect(e);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget && step !== 'processing') handleClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

                {/* Fixed Header */}
                <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-5 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl">table_chart</span>
                            {title}
                        </h2>
                        <p className="text-white/80 text-xs mt-0.5">{subtitle}</p>
                    </div>
                    {step !== 'processing' && (
                        <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0 ml-3">
                            <span className="material-symbols-outlined text-white text-xl">close</span>
                        </button>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5">

                    {/* ===== STEP: RESULT ===== */}
                    {step === 'result' && importResult && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">İçe Aktarma Tamamlandı</h3>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                                    <div className="text-xl font-bold text-green-600">{importResult.success}</div>
                                    <div className="text-[10px] font-semibold text-green-700 uppercase">Başarılı</div>
                                </div>
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                                    <div className="text-xl font-bold text-amber-600">{importResult.duplicates.length}</div>
                                    <div className="text-[10px] font-semibold text-amber-700 uppercase">Atlanan</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                                    <div className="text-xl font-bold text-red-600">{importResult.errors.length}</div>
                                    <div className="text-[10px] font-semibold text-red-700 uppercase">Hata</div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                    <div className="text-xl font-bold text-gray-600">{importResult.empty}</div>
                                    <div className="text-[10px] font-semibold text-gray-700 uppercase">Boş</div>
                                </div>
                            </div>

                            {(importResult.errors.length > 0 || importResult.duplicates.length > 0) && (
                                <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto text-xs border border-gray-200 space-y-1">
                                    {importResult.errors.map((err, idx) => (
                                        <div key={`e-${idx}`} className="text-red-600 flex items-start gap-1">
                                            <span className="font-bold mt-0.5">✕</span><span>{err}</span>
                                        </div>
                                    ))}
                                    {importResult.duplicates.map((dup, idx) => (
                                        <div key={`d-${idx}`} className="text-amber-600 flex items-start gap-1">
                                            <span className="font-bold mt-0.5">!</span><span>{dup}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== STEP: PROCESSING ===== */}
                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
                                <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <div className="w-full max-w-sm space-y-2">
                                <div className="flex justify-between text-sm font-bold text-gray-700">
                                    <span>İşleniyor...</span>
                                    <span>%{progress}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="text-center text-xs text-gray-400">{progressStatus}</div>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP: PREVIEW ===== */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base text-blue-500">preview</span>
                                    Önizleme ({allRows.length} satır)
                                </h3>
                                <button onClick={() => { setStep('config'); setAllRows([]); setPreviewRows([]); }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                                    Geri
                                </button>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                                            <th className="px-2 py-2 text-left font-semibold border-b">#</th>
                                            <th className="px-2 py-2 text-left font-semibold border-b">{mappingKey === 'stock_code' ? 'Stok Kodu' : 'Barkod'} (A)</th>
                                            <th className="px-2 py-2 text-left font-semibold border-b">Ürün Adı (B)</th>
                                            <th className="px-2 py-2 text-right font-semibold border-b">Fiyat (C)</th>
                                            <th className="px-2 py-2 text-left font-semibold border-b">Barkod (D)</th>
                                            <th className="px-2 py-2 text-left font-semibold border-b">Grup (E)</th>
                                            <th className="px-2 py-2 text-left font-semibold border-b">Marka (F)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {previewRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                                                <td className="px-2 py-1.5 font-mono font-medium text-gray-800">{row[0] || '-'}</td>
                                                <td className="px-2 py-1.5 text-gray-700">{row[1] || '-'}</td>
                                                <td className="px-2 py-1.5 text-right text-gray-700">{row[2] ?? '-'}</td>
                                                <td className="px-2 py-1.5 text-gray-500">{row[3] || '-'}</td>
                                                <td className="px-2 py-1.5 text-gray-500">{row[4] || '-'}</td>
                                                <td className="px-2 py-1.5 text-gray-500">{row[5] || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {allRows.length > 10 && (
                                <p className="text-xs text-gray-400 text-center">
                                    İlk 10 satır gösteriliyor. Toplamda {allRows.length} satır işlenecek.
                                </p>
                            )}

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">info</span>
                                    {type === 'new'
                                        ? `${allRows.length} yeni ürün eklenecek. Mevcut stok kodları/barkodlar atlanacak.`
                                        : `${allRows.length} ürün "${mappingKey === 'stock_code' ? 'Stok Kodu' : 'Barkod'}" ile eşleştirilecek ve seçili alanlar güncellenecek.`
                                    }
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ===== STEP: CONFIG ===== */}
                    {step === 'config' && (
                        <div className="space-y-4">
                            {/* Mapping Key */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-blue-500">key</span>
                                    A Sütunu Eşleştirme
                                </h3>
                                <div className="flex gap-3">
                                    {[
                                        { value: 'stock_code', label: 'Stok Kodu' },
                                        { value: 'barcode', label: 'Barkod' },
                                    ].map(opt => (
                                        <label key={opt.value} className={`flex-1 flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all text-sm ${mappingKey === opt.value ? 'bg-blue-500 text-white shadow-md' : 'bg-white border border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                                            <input type="radio" name="key" className="sr-only" checked={mappingKey === opt.value} onChange={() => setMappingKey(opt.value)} />
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mappingKey === opt.value ? 'border-white' : 'border-gray-400'}`}>
                                                {mappingKey === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                            <span className="font-semibold">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Column Mapping */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-purple-500">view_column</span>
                                    Sütun Eşleştirmesi
                                </h3>

                                <div className="bg-white rounded-lg p-2.5 mb-3 border border-gray-200 flex items-center gap-2 text-sm text-gray-600">
                                    <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-md flex items-center justify-center font-bold text-xs">A</span>
                                    <span className="font-medium">{mappingKey === 'stock_code' ? 'Stok Kodu' : 'Barkod'}</span>
                                    <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold">ZORUNLU</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'name', letter: 'B', label: 'Ürün Adı' },
                                        { key: 'price', letter: 'C', label: 'Fiyat' },
                                        { key: 'barcode', letter: 'D', label: 'Barkod' },
                                        { key: 'group', letter: 'E', label: 'Grup' },
                                        { key: 'brand', letter: 'F', label: 'Marka' },
                                    ].map(({ key, letter, label }) => (
                                        <label
                                            key={key}
                                            className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all text-sm ${columns[key] ? 'bg-purple-50 border border-purple-200' : 'bg-white border border-transparent hover:border-gray-200'}`}
                                        >
                                            <input type="checkbox" checked={columns[key]} onChange={(e) => setColumns({ ...columns, [key]: e.target.checked })} className="sr-only" />
                                            <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${columns[key] ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                                {columns[key] && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="w-5 h-5 bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold text-[10px]">{letter}</span>
                                            <span className="font-medium text-gray-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Sample Download */}
                            <div className="flex justify-end">
                                <button onClick={downloadSampleExcel} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline">
                                    <span className="material-symbols-outlined text-sm">download</span>
                                    Örnek Excel Şablonu İndir
                                </button>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragActive
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                                    }`}
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".xlsx, .xls" />
                                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl text-emerald-600">cloud_upload</span>
                                </div>
                                <p className="text-gray-700 font-semibold text-sm mb-0.5">
                                    Excel dosyasını sürükleyin veya tıklayın
                                </p>
                                <p className="text-gray-400 text-xs">.xlsx veya .xls</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed Footer */}
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex justify-end gap-2 flex-shrink-0">
                    {step === 'result' && (
                        <button onClick={handleClose} className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors">
                            Kapat
                        </button>
                    )}
                    {step === 'preview' && (
                        <>
                            <button onClick={() => { setStep('config'); setAllRows([]); setPreviewRows([]); }} className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold transition-all">
                                Geri
                            </button>
                            <button onClick={handleStartImport} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-md">
                                <span className="material-symbols-outlined text-base">play_arrow</span>
                                {type === 'new' ? `${allRows.length} Ürün Yükle` : `${allRows.length} Ürün Güncelle`}
                            </button>
                        </>
                    )}
                    {step === 'config' && (
                        <button onClick={handleClose} className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold transition-all">
                            İptal
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
