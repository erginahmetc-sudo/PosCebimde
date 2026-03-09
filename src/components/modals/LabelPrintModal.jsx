import { useState, useEffect } from 'react';
import LabelDesignerModal from './LabelDesignerModal';
import { PAPER_SIZES, DEFAULT_TEMPLATES } from '../../data/label_templates';

export default function LabelPrintModal({ isOpen, onClose, products }) {
    const [filterName, setFilterName] = useState('');
    const [filterGroup, setFilterGroup] = useState('Tümü');

    const [sourceList, setSourceList] = useState([]);
    const [printQueue, setPrintQueue] = useState([]);

    // Label Settings
    const [selectedPaperSize, setSelectedPaperSize] = useState('Termal 30x60mm');
    const [isDesignerOpen, setIsDesignerOpen] = useState(false);

    // Custom Paper Sizes
    const [customSizes, setCustomSizes] = useState({});
    const [isAddSizeModalOpen, setIsAddSizeModalOpen] = useState(false);
    const [newSizeName, setNewSizeName] = useState('');
    const [newSizeWidth, setNewSizeWidth] = useState('');
    const [newSizeHeight, setNewSizeHeight] = useState('');

    // Load template when modal opens or paper size changes
    const [currentTemplate, setCurrentTemplate] = useState(null);

    // Merge default and custom sizes
    const allPaperSizes = { ...customSizes, ...PAPER_SIZES };

    useEffect(() => {
        if (isOpen) {
            // Load custom sizes
            const savedSizes = localStorage.getItem('custom_label_sizes');
            if (savedSizes) {
                try {
                    setCustomSizes(JSON.parse(savedSizes));
                } catch (e) {
                    console.error("Error loading custom sizes", e);
                }
            }
            loadTemplate(selectedPaperSize);
        }
    }, [isOpen]);

    useEffect(() => {
        loadTemplate(selectedPaperSize);
    }, [selectedPaperSize, isDesignerOpen, customSizes]);

    const loadTemplate = (size) => {
        if (!size) return;
        const savedKey = `label_design_template_${size}`;
        const saved = localStorage.getItem(savedKey);

        // Check if we have a default template for this size
        const defaultTemplate = DEFAULT_TEMPLATES[size];

        if (saved) {
            try {
                setCurrentTemplate(JSON.parse(saved));
            } catch {
                setCurrentTemplate(defaultTemplate || createEmptyTemplate(size));
            }
        } else {
            setCurrentTemplate(defaultTemplate || createEmptyTemplate(size));
        }
    };

    const createEmptyTemplate = (sizeName) => {
        const size = allPaperSizes[sizeName];
        if (!size) return null;
        return {
            paper_size: sizeName,
            items: []
        };
    };

    const handleAddCustomSize = () => {
        if (!newSizeName || !newSizeWidth || !newSizeHeight) {
            alert("Lütfen tüm alanları doldurun.");
            return;
        }

        if (allPaperSizes[newSizeName]) {
            alert("Bu isimde bir boyut zaten var.");
            return;
        }

        const widthMm = parseFloat(newSizeWidth);
        const heightMm = parseFloat(newSizeHeight);

        // Convert mm to px (approx 3.78 px per mm at 96 DPI)
        const widthPx = Math.round(widthMm * 3.7795);
        const heightPx = Math.round(heightMm * 3.7795);

        const newSize = {
            width: widthPx,
            height: heightPx,
            widthMm: widthMm,
            heightMm: heightMm,
            type: 'thermal', // Default to thermal for custom sizes for simplicity
            labelsPerRow: 1,
            rowsPerPage: 1,
            isCustom: true
        };

        const updatedCustomSizes = { ...customSizes, [newSizeName]: newSize };
        setCustomSizes(updatedCustomSizes);
        localStorage.setItem('custom_label_sizes', JSON.stringify(updatedCustomSizes));

        setSelectedPaperSize(newSizeName);
        setIsAddSizeModalOpen(false);
        setNewSizeName('');
        setNewSizeWidth('');
        setNewSizeHeight('');
    };

    const handleDeleteCustomSize = (sizeName) => {
        if (window.confirm(`${sizeName} boyutunu silmek istediğinize emin misiniz?`)) {
            const updated = { ...customSizes };
            delete updated[sizeName];
            setCustomSizes(updated);
            localStorage.setItem('custom_label_sizes', JSON.stringify(updated));
            setSelectedPaperSize('Termal 30x60mm');
        }
    };

    const handleRenameCustomSize = () => {
        if (!allPaperSizes[selectedPaperSize]?.isCustom) return;

        const newName = prompt("Yeni isim giriniz:", selectedPaperSize);
        if (!newName || newName === selectedPaperSize) return;

        if (allPaperSizes[newName]) {
            alert("Bu isimde bir boyut zaten var.");
            return;
        }

        // 1. Update Custom Sizes
        const sizeData = customSizes[selectedPaperSize];
        const updatedCustomSizes = { ...customSizes };
        delete updatedCustomSizes[selectedPaperSize];
        updatedCustomSizes[newName] = sizeData;

        setCustomSizes(updatedCustomSizes);
        localStorage.setItem('custom_label_sizes', JSON.stringify(updatedCustomSizes));

        // 2. Move Template Data
        const oldKey = `label_design_template_${selectedPaperSize}`;
        const newKey = `label_design_template_${newName}`;
        const savedTemplate = localStorage.getItem(oldKey);

        if (savedTemplate) {
            let templateData = JSON.parse(savedTemplate);
            templateData.paper_size = newName; // Update internal name
            localStorage.setItem(newKey, JSON.stringify(templateData));
            localStorage.removeItem(oldKey); // Optional: keep or remove old
        }

        // 3. Select New Name
        setSelectedPaperSize(newName);
    };

    useEffect(() => {
        let filtered = products;
        if (filterName) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(filterName.toLowerCase()));
        }
        if (filterGroup && filterGroup !== 'Tümü') {
            filtered = filtered.filter(p => p.group === filterGroup);
        }
        setSourceList(filtered);
    }, [products, filterName, filterGroup]);

    const addToQueue = (product) => {
        setPrintQueue(prev => {
            const existing = prev.find(p => p.stock_code === product.stock_code);
            if (existing) {
                return prev.map(p => p.stock_code === product.stock_code ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const addAllFiltered = () => {
        const toAdd = sourceList.slice(0, 100).filter(p => !printQueue.some(pq => pq.stock_code === p.stock_code)).map(p => ({ ...p, quantity: 1 }));
        setPrintQueue(prev => [...prev, ...toAdd]);
    };

    const removeFromQueue = (index) => {
        setPrintQueue(prev => prev.filter((_, i) => i !== index));
    };

    const updateQuantity = (index, val) => {
        const newQ = [...printQueue];
        newQ[index].quantity = parseInt(val) || 1;
        setPrintQueue(newQ);
    };

    const handlePrint = () => {
        if (printQueue.length === 0) return alert("Listeye ürün ekleyin.");
        if (!currentTemplate) return alert("Şablon yüklenemedi.");

        const paperSettings = allPaperSizes[currentTemplate.paper_size];
        if (!paperSettings) return alert("Kağıt ayarları bulunamadı.");

        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Yazıcı penceresi açılamadı. Lütfen açılır pencerelere izin verin.");

        // Prepare items list (flattened by quantity)
        const allItems = printQueue.flatMap(item => Array(item.quantity).fill(item));

        // Generate HTML based on paper type
        let contentHtml = '';

        // Calculate dimensions in mm for @page
        let pageWidthMm = paperSettings.widthMm || Math.round(paperSettings.width / 3.7795);
        let pageHeightMm = paperSettings.heightMm || Math.round(paperSettings.height / 3.7795);

        if (paperSettings.type === 'thermal') {
            // Thermal: Single column of labels
            contentHtml = allItems.map(product => generateLabelHtml(product, currentTemplate, paperSettings)).join('');
        } else if (paperSettings.type === 'a4') {
            // A4: Grid layout
            const itemsPerPage = paperSettings.rowsPerPage * paperSettings.labelsPerRow;
            const pages = [];

            for (let i = 0; i < allItems.length; i += itemsPerPage) {
                const pageItems = allItems.slice(i, i + itemsPerPage);
                pages.push(pageItems);
            }

            contentHtml = pages.map(pageItems => `
                <div class="a4-page">
                    ${pageItems.map(product => generateLabelHtml(product, currentTemplate, paperSettings)).join('')}
                </div>
            `).join('');
        }

        const html = `<!DOCTYPE html>
            <html>
                <head>
                    <title>Etiket Yazdır - ${currentTemplate.paper_size}</title>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Libre+Barcode+128+Text&display=swap');

                        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }

                        /* Layout Styles */
                        ${paperSettings.type === 'thermal' ? `
                            .label-container {
                                width: ${paperSettings.width}px;
                                height: ${paperSettings.height}px;
                                position: relative;
                                page-break-after: always;
                                overflow: hidden;
                                box-sizing: border-box;
                            }
                        ` : `
                            .a4-page {
                                width: ${paperSettings.width}px;
                                height: ${paperSettings.height}px;
                                position: relative;
                                page-break-after: always;
                                background: white;
                                padding-top: ${paperSettings.marginTop}px;
                                padding-left: ${paperSettings.marginLeft}px;
                            }
                            .label-container {
                                width: ${paperSettings.labelWidth}px;
                                height: ${paperSettings.labelHeight}px;
                                position: relative;
                                float: left;
                                margin-right: ${paperSettings.horizontalGap}px;
                                margin-bottom: ${paperSettings.verticalGap}px;
                                overflow: hidden;
                                box-sizing: border-box;
                                /* border: 1px dotted #eee; Debug border */
                            }
                            /* Clearfix for rows */
                            .a4-page::after { content: ""; display: table; clear: both; }

                            /* Remove right margin for last item in row */
                            .label-container:nth-child(${paperSettings.labelsPerRow}n) {
                                margin-right: 0;
                            }
                        `}

                        /* Element Styles */
                        .element { position: absolute; display: flex; align-items: center; overflow: hidden; white-space: pre-wrap; line-height: 1.2; }
                        .element img { width: 100%; height: 100%; object-fit: contain; }

                        @media print {
                            @page { margin: 0; size: ${pageWidthMm}mm ${pageHeightMm}mm; }
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${contentHtml}
                    <script>
                        window.onload = () => {
                            // Initialize all barcodes
                            if (typeof JsBarcode !== 'undefined') {
                                JsBarcode(".barcode-element").init();
                            }

                            // Initialize all QR codes
                            if (typeof QRCode !== 'undefined') {
                                const qrElements = document.querySelectorAll('.qrcode-element');
                                qrElements.forEach(el => {
                                    const text = el.getAttribute('data-text');
                                    const width = parseInt(el.getAttribute('data-width')) || 80;
                                    const color = el.getAttribute('data-color') || '#000000';
                                    
                                    QRCode.toCanvas(el, text, {
                                        width: width,
                                        margin: 1,
                                        color: {
                                            dark: color,
                                            light: '#00000000' // Transparent background
                                        }
                                    }, function (error) {
                                        if (error) console.error(error);
                                    });
                                });
                            }
                            
                            setTimeout(() => {
                                window.print();
                            }, 1000); // Increased timeout to ensure barcodes render
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const generateLabelHtml = (product, template, paperSettings) => {
        // Variable Replacement
        const replaceVariables = (text) => {
            if (!text) return '';
            return text
                .replace(/{{URUN_ADI}}/g, product.name || '')
                .replace(/{{FIYAT}}/g, parseFloat(product.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 }))
                .replace(/{{BARKOD}}/g, product.barcode || product.stock_code || '')
                .replace(/{{BARKOD_NO}}/g, product.barcode || product.stock_code || '')
                .replace(/{{BARKOD_QR}}/g, product.barcode || product.stock_code || '')
                .replace(/{{STOK_KODU}}/g, product.stock_code || '')
                .replace(/{{MARKA}}/g, product.brand || '')
                .replace(/{{GRUP}}/g, product.group || '')
                .replace(/{{TARIH}}/g, new Date().toLocaleDateString('tr-TR'))
                .replace(/{{PARA_BIRIMI}}/g, '₺');
        };

        const elementsHtml = template.items.map((item, itemIndex) => {
            const isSingleLine = item.type === 'text' && item.height <= (item.font_size || 12) * 1.6;
            const isMultiLine = item.type === 'text' && item.max_lines && item.max_lines > 1;
            const fontFamily = (item.is_barcode || item.text === '{{BARKOD}}') ? "'Libre Barcode 128 Text', cursive" : (item.font_family || 'sans-serif');
            const fontStyle = (item.font_style === 'italic' || item.font_style === 'semi-condensed-italic') ? 'italic' : 'normal';
            const fontStretch = (item.font_style === 'semi-condensed' || item.font_style === 'semi-condensed-italic') ? 'semi-condensed' : 'normal';

            const style = `
                left: ${item.x}px;
                top: ${item.y}px;
                width: ${item.width}px;
                height: ${item.height}px;
                overflow: ${(item.is_barcode || item.text === '{{BARKOD}}') ? 'visible' : 'hidden'};
                font-family: ${fontFamily};
                font-size: ${item.font_size}px;
                font-weight: ${item.font_bold ? 'bold' : 'normal'};
                font-style: ${fontStyle};
                font-stretch: ${fontStretch};
                color: ${item.color};
                text-align: ${item.text_align};
                ${!(item.is_barcode || item.text === '{{BARKOD}}') && item.barcode_scale_x !== undefined ? `transform: scaleX(${item.barcode_scale_x}); transform-origin: center;` : ''}
                background-color: ${item.type === 'shape' ? (item.fill_color || 'transparent') : 'transparent'};
                ${item.border ? `border: ${item.border.thickness}px solid ${item.border.color};` : ''}
                z-index: ${itemIndex + 1};
                ${!(item.is_barcode || item.text === '{{BARKOD}}') ? 'padding-top: 2px;' : ''}
                ${!(item.is_barcode || item.text === '{{BARKOD}}') && isMultiLine
                    ? `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${item.max_lines}; white-space: normal; word-break: break-word; line-height: 1.3;`
                    : !(item.is_barcode || item.text === '{{BARKOD}}') && isSingleLine
                        ? `white-space: nowrap; text-overflow: ellipsis; line-height: 1.2;`
                        : `white-space: normal; word-break: break-word; line-height: 1.2;`
                }
                ${(item.is_barcode || item.text === '{{BARKOD}}') ? 'display: flex; align-items: center; justify-content: center;' : ''}
            `;

            if (item.type === 'text') {
                if (item.is_barcode || item.text === '{{BARKOD}}') {
                    // Render SVG container for barcode, JsBarcode will render into this
                    return `<div class="element" style="${style}">
                        <svg class="barcode-element"
                            jsbarcode-value="${replaceVariables(item.text) || '1234567890'}"
                            jsbarcode-format="CODE128"
                            jsbarcode-width="${item.barcode_width || 2}"
                            jsbarcode-height="${item.barcode_height || 40}"
                            jsbarcode-displayvalue="${item.barcode_display_value === true}"
                            jsbarcode-fontsize="${item.font_size || 14}"
                            jsbarcode-margin="10"
                            jsbarcode-textmargin="0"
                            jsbarcode-background="transparent"
                            jsbarcode-linecolor="${item.color || '#000000'}"
                            style="max-width: 100%; max-height: 100%;"
                        ></svg>
                    </div>`;
                }

                if (item.is_qrcode || item.text === '{{BARKOD_QR}}') {
                    // Render Canvas for QR code
                    return `<div class="element" style="${style}">
                        <canvas class="qrcode-element"
                            data-text="${replaceVariables(item.text) || '1234567890'}"
                            data-width="${Math.min(item.width, item.height)}"
                            data-color="${item.color || '#000000'}"
                            style="width: 100%; height: 100%; object-fit: contain;"
                        ></canvas>
                    </div>`;
                }

                const content = replaceVariables(item.text);
                return `<div class="element" style="${style}">${content}</div>`;
            }
        }).join('');

        return `<div class="label-container">${elementsHtml}</div>`;
    };

    if (!isOpen) return null;

    const uniqueGroups = ['Tümü', ...new Set(products.map(p => p.group).filter(Boolean))];
    const totalLabels = printQueue.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-8 py-6 flex-shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </div>
                                    Ürün Etiketi Yazdır
                                </h2>
                                <p className="text-white/80 mt-2 text-sm">Ürünleriniz için fiyat etiketi oluşturun ve yazdırın</p>
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
                    </div>

                    <div className="flex-1 flex min-h-0 bg-gradient-to-br from-gray-50 to-orange-50/30 p-4 gap-4">
                        {/* LEFT PANEL: Filters */}
                        <div className="w-64 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col p-5 gap-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Filtrele
                            </h3>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ürün Adı</label>
                                <input
                                    className="w-full mt-2 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                    placeholder="Ara..."
                                    value={filterName}
                                    onChange={e => setFilterName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grup</label>
                                <select
                                    className="w-full mt-2 px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                    value={filterGroup}
                                    onChange={e => setFilterGroup(e.target.value)}
                                >
                                    {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => { setFilterName(''); setFilterGroup('Tümü'); }}
                                className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-all text-sm"
                            >
                                Temizle
                            </button>
                            <div className="mt-auto pt-4 border-t border-gray-100">
                                <button
                                    onClick={addAllFiltered}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                >
                                    Tümünü Ekle
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* CENTER PANEL: Source List */}
                        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <span className="font-bold text-gray-800 text-sm">Ürün Listesi</span>
                                <span className="text-gray-500 text-xs">{sourceList.length} ürün</span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 w-16">Ekle</th>
                                            <th className="px-4 py-3">Stok Kodu</th>
                                            <th className="px-4 py-3">Ürün Adı</th>
                                            <th className="px-4 py-3 text-right">Fiyat</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {sourceList.map((p) => (
                                            <tr key={p.stock_code} className="hover:bg-orange-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => addToQueue(p)}
                                                        className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-md transition-all"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">{p.stock_code}</span>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-[200px]">{p.name}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">₺{parseFloat(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {sourceList.length === 0 && (
                                    <div className="text-center py-12 text-gray-400">Ürün bulunamadı</div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT PANEL: Settings & print Queue */}
                        <div className="w-80 flex flex-col gap-4">

                            {/* Settings Card */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-800">Etiket Ayarları</h3>
                                    <button
                                        onClick={() => setIsAddSizeModalOpen(true)}
                                        className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 transition-colors"
                                    >
                                        + Yeni Boyut
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kağıt Boyutu</label>
                                            {allPaperSizes[selectedPaperSize]?.isCustom && (
                                                <button
                                                    onClick={() => handleDeleteCustomSize(selectedPaperSize)}
                                                    className="text-[10px] text-red-500 hover:text-red-700 underline"
                                                >
                                                    Sil
                                                </button>
                                            )}
                                        </div>
                                        <select
                                            value={selectedPaperSize}
                                            onChange={(e) => setSelectedPaperSize(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                                        >
                                            {Object.keys(allPaperSizes).map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsDesignerOpen(true)}
                                            className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Şablonu Düzenle
                                        </button>

                                        {allPaperSizes[selectedPaperSize]?.isCustom && (
                                            <button
                                                onClick={handleRenameCustomSize}
                                                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center"
                                                title="İsmi Değiştir"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Print Queue */}
                            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <span className="font-bold text-gray-800 text-sm">Yazdırılacaklar</span>
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{totalLabels}</span>
                                </div>
                                <div className="flex-1 overflow-auto p-3 space-y-2">
                                    {printQueue.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-orange-50/50 p-3 rounded-xl border border-gray-100 group">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-800 text-sm truncate">{item.name}</div>
                                                <div className="text-xs text-orange-600 font-mono">{item.stock_code}</div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    min="1"
                                                    onChange={(e) => updateQuantity(i, e.target.value)}
                                                    className="w-10 px-1 py-1 bg-white border border-gray-200 rounded text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <button
                                                    onClick={() => removeFromQueue(i)}
                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {printQueue.length === 0 && (
                                        <div className="text-center py-8">
                                            <p className="text-gray-400 text-xs">Liste boş</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 space-y-2">
                                    <button
                                        onClick={handlePrint}
                                        disabled={printQueue.length === 0}
                                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${printQueue.length === 0
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:-translate-y-0.5'
                                            }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Yazdır
                                    </button>
                                    {printQueue.length > 0 && (
                                        <button
                                            onClick={() => setPrintQueue([])}
                                            className="w-full py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-all text-xs"
                                        >
                                            Listeyi Temizle
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Custom Paper Size Modal */}
            {isAddSizeModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-bold">Yeni Kağıt Boyutu</h3>
                            <button onClick={() => setIsAddSizeModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Boyut Adı</label>
                                <input
                                    type="text"
                                    value={newSizeName}
                                    onChange={e => setNewSizeName(e.target.value)}
                                    placeholder="Örn: Küçük Raf Etiketi"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Genişlik (mm)</label>
                                    <input
                                        type="number"
                                        value={newSizeWidth}
                                        onChange={e => setNewSizeWidth(e.target.value)}
                                        placeholder="40"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Yükseklik (mm)</label>
                                    <input
                                        type="number"
                                        value={newSizeHeight}
                                        onChange={e => setNewSizeHeight(e.target.value)}
                                        placeholder="20"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAddCustomSize}
                                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                            >
                                Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Label Designer Modal */}
            <LabelDesignerModal
                isOpen={isDesignerOpen}
                onClose={() => setIsDesignerOpen(false)}
                initialPaperSize={selectedPaperSize}
                allPaperSizes={allPaperSizes}
            />
        </>
    );
}
