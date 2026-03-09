import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { PAPER_SIZES, DEFAULT_TEMPLATES, AVAILABLE_VARIABLES } from '../../data/label_templates';

const FONT_FAMILIES = [

    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
];

const FONT_STYLES = [
    { label: 'Normal', value: 'normal' },
    { label: 'İtalik', value: 'italic' },
    { label: 'Yarı Sıkıştırılmış', value: 'semi-condensed' },
    { label: 'Yarı Sıkıştırılmış İtalik', value: 'semi-condensed-italic' },
];

export default function LabelDesignerModal({ isOpen, onClose, initialPaperSize, allPaperSizes, onUpdatePaperSize }) {
    const [template, setTemplate] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);

    // Zoom state for better visibility of small labels
    const [zoom, setZoom] = useState(1);

    // Use passed sizes or default
    const paperSizes = allPaperSizes || PAPER_SIZES;

    // Keyboard handling for moving and resizing
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedItem) return;

            // Prevent default scrolling for arrow keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }

            setTemplate(prev => {
                const items = [...prev.items];
                const index = items.findIndex(i => i.id === selectedItem);
                if (index === -1) return prev;

                const item = { ...items[index] };
                const moveAmount = e.shiftKey ? 10 : 1; // Shift for faster movement
                const resizeAmount = e.shiftKey ? 10 : 1;

                if (e.altKey) {
                    // Resize with ALT
                    if (e.key === 'ArrowRight') item.width += resizeAmount;
                    if (e.key === 'ArrowLeft') item.width = Math.max(10, item.width - resizeAmount);
                    if (e.key === 'ArrowDown') item.height += resizeAmount;
                    if (e.key === 'ArrowUp') item.height = Math.max(10, item.height - resizeAmount);
                } else {
                    // Move
                    if (e.key === 'ArrowRight') item.x += moveAmount;
                    if (e.key === 'ArrowLeft') item.x -= moveAmount;
                    if (e.key === 'ArrowDown') item.y += moveAmount;
                    if (e.key === 'ArrowUp') item.y -= moveAmount;
                }

                items[index] = item;
                return { ...prev, items };
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem]);

    useEffect(() => {
        if (isOpen) {
            // Try to load saved template or use default
            const sizeToLoad = initialPaperSize || 'Termal 30x60mm';
            const savedKey = `label_design_template_${sizeToLoad}`;
            const saved = localStorage.getItem(savedKey);

            if (saved) {
                try {
                    setTemplate(JSON.parse(saved));
                } catch {
                    setTemplate(DEFAULT_TEMPLATES[sizeToLoad] || createEmptyTemplate(sizeToLoad));
                }
            } else {
                setTemplate(DEFAULT_TEMPLATES[sizeToLoad] || createEmptyTemplate(sizeToLoad));
            }
        }
    }, [isOpen, initialPaperSize]);

    // Re-draw barcodes when template items change
    useEffect(() => {
        if (!template) return;
        const barcodeItems = template.items.filter(item => item.is_barcode || item.text === '{{BARKOD}}');
        if (barcodeItems.length === 0) return;

        const renderBarcodes = () => {
            barcodeItems.forEach(item => {
                const el = document.getElementById(`barcode-${item.id}`);
                if (!el) return;
                try {
                    window.JsBarcode(el, item.text === '{{BARKOD}}' ? '1234567890' : (item.text || '1234567890'), {
                        format: "CODE128",
                        width: item.barcode_width || 2,
                        height: item.barcode_height || 40,
                        displayValue: item.barcode_display_value === true,
                        fontSize: item.font_size || 14,
                        margin: 10,
                        textMargin: 0,
                        background: "transparent",
                        lineColor: item.color || "#000000"
                    });
                } catch (e) {
                    console.error("Barcode rendering error:", e);
                }
            });
        };

        // Load JsBarcode from CDN if not already loaded
        if (window.JsBarcode) {
            renderBarcodes();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
            script.onload = renderBarcodes;
            document.head.appendChild(script);
        }
    }, [template]);

    // Render QR codes when template items change
    useEffect(() => {
        if (!template) return;
        const qrItems = template.items.filter(item => item.is_qrcode || item.text === '{{BARKOD_QR}}');
        if (qrItems.length === 0) return;

        qrItems.forEach(item => {
            const el = document.getElementById(`qrcode-${item.id}`);
            if (!el) return;
            const value = item.text === '{{BARKOD_QR}}' ? '1234567890' : (item.text || '1234567890');
            QRCode.toDataURL(value, {
                width: Math.min(item.width, item.height) || 80,
                margin: 1,
                color: { dark: item.color || '#000000', light: '#ffffff' }
            }).then(url => {
                el.src = url;
            }).catch(err => console.error('QR rendering error:', err));
        });
    }, [template]);

    const createEmptyTemplate = (sizeName) => {
        return {
            paper_size: sizeName,
            items: []
        };
    };

    if (!isOpen || !template) return null;

    const currentPaper = paperSizes[template.paper_size];
    // For editing, we use the dimensions of a SINGLE LABEL, not the whole page if it's A4
    const canvasWidth = currentPaper?.type === 'a4' ? currentPaper.labelWidth : currentPaper?.width || 300;
    const canvasHeight = currentPaper?.type === 'a4' ? currentPaper.labelHeight : currentPaper?.height || 200;

    const handleSave = () => {
        const savedKey = `label_design_template_${template.paper_size}`;
        localStorage.setItem(savedKey, JSON.stringify(template));
        alert(`${template.paper_size} için tasarım kaydedildi!`);
    };

    const handleReset = () => {
        if (confirm('Varsayılan şablona dönmek istediğinize emin misiniz?')) {
            setTemplate(DEFAULT_TEMPLATES[template.paper_size] || createEmptyTemplate(template.paper_size));
            setSelectedItem(null);
        }
    };

    const handlePaperSizeChange = (newSize) => {
        if (template.paper_size === newSize) return;

        if (confirm(`Kağıt boyutunu "${newSize}" olarak değiştirmek mevcut tasarımı sıfırlayacaktır. Devam etmek istiyor musunuz?`)) {
            if (onUpdatePaperSize) {
                onUpdatePaperSize(newSize);
            }
            // Logic to load template is handled by useEffect when initialPaperSize prop updates
            setSelectedItem(null);
        }
    };

    const handleAddText = () => {
        const newItem = {
            type: 'text',
            id: `text_${Date.now()}`,
            x: 10,
            y: 10,
            width: 100,
            height: 20,
            text: 'Yeni Metin',
            font_family: 'Inter',
            font_size: 12,
            font_bold: false,
            color: '#000000',
            text_align: 'left',
            max_lines: 1,
        };
        setTemplate(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSelectedItem(newItem.id);
        setSelectedItem(newItem.id);
    };

    const handleCopyConfig = () => {
        const config = JSON.stringify(template, null, 2);
        navigator.clipboard.writeText(config).then(() => {
            alert("Tasarım ayarları kopyalandı! Lütfen bu kodu sohbet penceresine yapıştırın.");
        });
    };

    const handleAddVariable = (variableKey) => {
        const isBarcode = variableKey === '{{BARKOD}}';
        const isQR = variableKey === '{{BARKOD_QR}}';
        const newItem = {
            type: 'text',
            id: `var_${Date.now()}`,
            x: 10,
            y: 10,
            width: isQR ? 80 : (isBarcode ? 150 : 120),
            height: isQR ? 80 : (isBarcode ? 50 : 20),
            text: variableKey,
            font_family: (isBarcode || isQR) ? undefined : 'Inter, sans-serif',
            font_size: isBarcode ? 14 : 12,
            font_bold: !(isBarcode || isQR),
            font_style: 'normal',
            color: '#000000',
            text_align: (isBarcode || isQR) ? 'center' : 'left',
            is_barcode: isBarcode,
            is_qrcode: isQR,
            max_lines: 1,
            barcode_width: isBarcode ? 2 : undefined,
            barcode_height: isBarcode ? 40 : undefined,
            barcode_display_value: false,
        };
        setTemplate(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSelectedItem(newItem.id);
    };

    const handleAddShape = () => {
        const newItem = {
            type: 'shape',
            id: `shape_${Date.now()}`,
            x: 20,
            y: 20,
            width: 50,
            height: 50,
            fill_color: '#e5e7eb',
            border: { thickness: 1, color: '#000000' }
        };
        setTemplate(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSelectedItem(newItem.id);
    };

    const handleDeleteItem = () => {
        if (!selectedItem) return;
        setTemplate(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== selectedItem)
        }));
        setSelectedItem(null);
    };

    const updateSelectedItem = (field, value) => {
        if (!selectedItem) return;
        setTemplate(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === selectedItem) {
                    const updated = { ...item, [field]: value };

                    // Auto-detect barcode when user types {{BARKOD}}
                    if (field === 'text' && value === '{{BARKOD}}' && !item.is_barcode) {
                        updated.is_barcode = true;
                        updated.text_align = 'center';
                        updated.barcode_width = 2;
                        updated.barcode_height = 40;
                        updated.barcode_display_value = true;
                        updated.font_size = 14;
                        // Auto-adjust dimensions if still default
                        if (item.width < 150) updated.width = 150;
                        if (item.height < 50) updated.height = 50;
                        if (item.max_lines === 1) updated.max_lines = 1;
                    }
                    // Remove barcode flag if user changes text away from {{BARKOD}}
                    if (field === 'text' && value !== '{{BARKOD}}' && item.is_barcode) {
                        updated.is_barcode = false;
                    }

                    // Auto-adjust height when max_lines changes
                    if (field === 'max_lines' && item.type === 'text') {
                        const lineHeight = (updated.font_size || 12) * 1.3;
                        updated.height = Math.round(lineHeight * value);
                    }
                    // Auto-adjust height when font_size changes and max_lines is set
                    if (field === 'font_size' && item.type === 'text' && item.max_lines) {
                        const lineHeight = value * 1.3;
                        updated.height = Math.round(lineHeight * item.max_lines);
                    }
                    return updated;
                }
                return item;
            })
        }));
    };

    // Drag handlers
    const handleMouseDown = (e, item) => {
        e.stopPropagation();
        setSelectedItem(item.id);
        setDraggedItem(item.id);
        const rect = canvasRef.current.getBoundingClientRect();
        // Adjust for zoom
        const clickX = (e.clientX - rect.left) / zoom;
        const clickY = (e.clientY - rect.top) / zoom;

        setDragOffset({
            x: clickX - item.x,
            y: clickY - item.y
        });
    };

    const handleMouseMove = (e) => {
        if (!draggedItem) return;
        const rect = canvasRef.current.getBoundingClientRect();

        // Calculate raw position considering zoom
        const rawX = (e.clientX - rect.left) / zoom;
        const rawY = (e.clientY - rect.top) / zoom;

        const newX = rawX - dragOffset.x;
        const newY = rawY - dragOffset.y;

        // Snap to grid (optional, can be added later)

        setTemplate(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === draggedItem ? { ...item, x: Math.round(newX), y: Math.round(newY) } : item
            )
        }));
    };

    const handleMouseUp = () => {
        setDraggedItem(null);
    };

    // Estimate how many lines the text will take based on width and font
    const calculateEstimatedLines = (item) => {
        if (item.type !== 'text' || !item.text) return 1;

        // Average character width is roughly 0.6 times the font size (varies by font)
        const avgCharWidth = (item.font_size || 12) * 0.6;
        const charsPerLine = Math.floor(item.width / avgCharWidth);

        if (charsPerLine <= 0) return 1;

        // Split by existing line breaks first
        const lines = item.text.split('\n');
        let totalLines = 0;

        lines.forEach(line => {
            if (line.length === 0) {
                totalLines += 1; // Empty line
            } else {
                totalLines += Math.ceil(line.length / charsPerLine);
            }
        });

        return totalLines;
    };

    const selectedItemData = template.items.find(item => item.id === selectedItem);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Etiket Tasarımcısı</h2>
                            <p className="text-white/70 text-sm">Ürün etiketlerini özelleştirin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Tools */}
                    <div className="w-72 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-6 overflow-y-auto">

                        {/* Paper Size Selector */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kağıt / Etiket Boyutu</h3>
                            <select
                                value={template.paper_size}
                                onChange={(e) => handlePaperSizeChange(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            >
                                {Object.keys(paperSizes).map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>

                        {/* Add Elements */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Element Ekle</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleAddText}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Metin
                                </button>
                                <button
                                    onClick={handleAddShape}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                                    Şekil
                                </button>
                            </div>
                        </div>

                        {/* Variables */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Değişkenler (Otomatik)</h3>
                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {AVAILABLE_VARIABLES.map(variable => (
                                    <button
                                        key={variable.key}
                                        onClick={() => handleAddVariable(variable.key)}
                                        className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-all group flex justify-between items-center"
                                    >
                                        <span className="font-medium">{variable.label}</span>
                                        <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600">{variable.key}</code>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-auto space-y-3">
                            <button
                                onClick={handleSave}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                Şablonu Kaydet
                            </button>
                            <button
                                onClick={handleReset}
                                className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
                            >
                                Varsayılana Dön
                            </button>
                            <button
                                onClick={handleCopyConfig}
                                className="w-full py-2 bg-slate-50 text-slate-400 rounded-xl font-medium text-xs hover:bg-slate-100 transition-all border border-slate-200"
                            >
                                Yapılandırmayı Kopyala (Destek İçin)
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 bg-slate-100 p-8 overflow-hidden flex flex-col relative">
                        {/* Toolbar */}
                        <div className="absolute top-4 right-4 flex gap-2 bg-white p-1.5 rounded-lg shadow-sm border border-slate-200 z-10">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            </button>
                            <span className="text-xs font-medium text-slate-600 flex items-center px-1 min-w-[3rem] justify-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto flex items-center justify-center">
                            <div
                                ref={canvasRef}
                                className="bg-white shadow-xl relative transition-transform duration-200 ease-out origin-center"
                                style={{
                                    width: canvasWidth,
                                    height: canvasHeight,
                                    transform: `scale(${zoom})`,
                                    backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)',
                                    backgroundSize: '10px 10px'
                                }}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onClick={() => setSelectedItem(null)}
                            >
                                {template.items.map((item, itemIndex) => (
                                    <div
                                        key={item.id}
                                        className={`absolute cursor-move group ${selectedItem === item.id ? 'ring-2 ring-orange-500 ring-offset-2' : 'hover:outline hover:outline-1 hover:outline-orange-300'}`}
                                        style={{
                                            left: item.x,
                                            top: item.y,
                                            width: item.width,
                                            height: item.height,
                                            zIndex: selectedItem === item.id ? template.items.length + 10 : itemIndex + 1,
                                            backgroundColor: item.type === 'shape' ? item.fill_color : 'transparent',
                                            border: item.border ? `${item.border.thickness}px solid ${item.border.color}` : 'none',
                                            fontFamily: (item.is_barcode || item.text === '{{BARKOD}}') ? 'sans-serif' : (item.font_family || 'Inter, sans-serif'),
                                            fontSize: item.font_size,
                                            fontWeight: item.font_bold ? 'bold' : 'normal',
                                            fontStyle: (item.font_style === 'italic' || item.font_style === 'semi-condensed-italic') ? 'italic' : 'normal',
                                            fontStretch: (item.font_style === 'semi-condensed' || item.font_style === 'semi-condensed-italic') ? 'semi-condensed' : 'normal',
                                            color: item.color,
                                            textAlign: item.text_align,
                                            overflow: 'hidden',
                                            padding: 0,
                                            // Barcode: flex center for SVG; Text: normal text layout
                                            ...((item.is_barcode || item.text === '{{BARKOD}}')
                                                ? {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }
                                                : {
                                                    paddingTop: '2px',
                                                    ...(item.type === 'text' && item.max_lines && item.max_lines > 1
                                                        ? {
                                                            display: '-webkit-box',
                                                            WebkitBoxOrient: 'vertical',
                                                            WebkitLineClamp: item.max_lines,
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            lineHeight: '1.3',
                                                        }
                                                        : item.type === 'text' && item.height <= (item.font_size || 12) * 1.6
                                                            ? {
                                                                whiteSpace: 'nowrap',
                                                                textOverflow: 'ellipsis',
                                                                lineHeight: '1.2',
                                                            }
                                                            : {
                                                                whiteSpace: 'normal',
                                                                wordBreak: 'break-word',
                                                                lineHeight: '1.2',
                                                            }
                                                    ),
                                                }
                                            ),
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, item)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {(item.is_barcode || item.text === '{{BARKOD}}') ? (
                                            <svg id={`barcode-${item.id}`} style={{ maxWidth: '100%', maxHeight: '100%' }}></svg>
                                        ) : (item.is_qrcode || item.text === '{{BARKOD_QR}}') ? (
                                            <img id={`qrcode-${item.id}`} style={{ maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%', objectFit: 'contain' }} alt="QR Code" />
                                        ) : (
                                            item.type === 'text' && <span>{item.text}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Layout Info Footer */}
                        <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500">
                            {currentPaper?.type === 'a4' ? (
                                <span>A4 Sayfada {currentPaper.rowsPerPage}x{currentPaper.labelsPerRow} düzen | Etiket: {currentPaper.labelWidth}x{currentPaper.labelHeight}px</span>
                            ) : (
                                <span>Termal Rulo | {currentPaper?.width}x{currentPaper?.height}px</span>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Properties */}
                    <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-y-auto">
                        {selectedItemData ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Özellikler</h3>
                                    <button onClick={handleDeleteItem} className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>

                                {/* Position Box */}
                                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">X Konumu</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.x}
                                            onChange={(e) => updateSelectedItem('x', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Y Konumu</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.y}
                                            onChange={(e) => updateSelectedItem('y', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Genişlik</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.width}
                                            onChange={(e) => updateSelectedItem('width', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Yükseklik</label>
                                        <input
                                            type="number"
                                            value={selectedItemData.height}
                                            onChange={(e) => updateSelectedItem('height', parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
                                        />
                                    </div>
                                </div>

                                {/* Z-Order Controls */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Katman Sırası</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                setTemplate(prev => {
                                                    const items = [...prev.items];
                                                    const index = items.findIndex(i => i.id === selectedItem);
                                                    if (index <= 0) return prev;
                                                    // Move to beginning (bottom/back)
                                                    const [item] = items.splice(index, 1);
                                                    items.unshift(item);
                                                    return { ...prev, items };
                                                });
                                            }}
                                            className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                            Alta Gönder
                                        </button>
                                        <button
                                            onClick={() => {
                                                setTemplate(prev => {
                                                    const items = [...prev.items];
                                                    const index = items.findIndex(i => i.id === selectedItem);
                                                    if (index === -1 || index === items.length - 1) return prev;
                                                    // Move to end (top/front)
                                                    const [item] = items.splice(index, 1);
                                                    items.push(item);
                                                    return { ...prev, items };
                                                });
                                            }}
                                            className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                            Üste Gönder
                                        </button>
                                        <button
                                            onClick={() => {
                                                setTemplate(prev => {
                                                    const items = [...prev.items];
                                                    const index = items.findIndex(i => i.id === selectedItem);
                                                    if (index <= 0) return prev;
                                                    // Swap with previous (one step back)
                                                    [items[index], items[index - 1]] = [items[index - 1], items[index]];
                                                    return { ...prev, items };
                                                });
                                            }}
                                            className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            Bir Alta
                                        </button>
                                        <button
                                            onClick={() => {
                                                setTemplate(prev => {
                                                    const items = [...prev.items];
                                                    const index = items.findIndex(i => i.id === selectedItem);
                                                    if (index === -1 || index === items.length - 1) return prev;
                                                    // Swap with next (one step forward)
                                                    [items[index], items[index + 1]] = [items[index + 1], items[index]];
                                                    return { ...prev, items };
                                                });
                                            }}
                                            className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                            Bir Üste
                                        </button>
                                    </div>
                                </div>

                                {selectedItemData.type === 'text' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Metin İçeriği</label>
                                            <textarea
                                                rows={3}
                                                value={selectedItemData.text}
                                                onChange={(e) => updateSelectedItem('text', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Değişken kullanabilirsiniz: {'{{URUN_ADI}}'}</p>
                                        </div>

                                        {/* Font Family */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Yazı Tipi</label>
                                            <select
                                                value={selectedItemData.font_family || 'Inter, sans-serif'}
                                                onChange={(e) => updateSelectedItem('font_family', e.target.value)}
                                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            >
                                                {FONT_FAMILIES.map(f => (
                                                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                                                ))}
                                                <option value="Libre Barcode 128 Text">Barkod (Code 128)</option>
                                            </select>
                                        </div>

                                        {/* Font Style */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Yazı Stili</label>
                                            <select
                                                value={selectedItemData.font_style || 'normal'}
                                                onChange={(e) => updateSelectedItem('font_style', e.target.value)}
                                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                            >
                                                {FONT_STYLES.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Barcode Controls */}
                                        {(selectedItemData.is_barcode || selectedItemData.text === '{{BARKOD}}') && (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Çubuk Genişliği</label>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="4"
                                                        step="0.5"
                                                        value={selectedItemData.barcode_width || 2}
                                                        onChange={(e) => updateSelectedItem('barcode_width', parseFloat(e.target.value))}
                                                        className="w-full"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                                        <span>İnce (1)</span>
                                                        <span className="font-medium text-slate-600">{selectedItemData.barcode_width || 2}</span>
                                                        <span>Kalın (4)</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Barkod Yüksekliği</label>
                                                    <input
                                                        type="number"
                                                        value={selectedItemData.barcode_height || 40}
                                                        onChange={(e) => updateSelectedItem('barcode_height', parseInt(e.target.value))}
                                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                    />
                                                </div>
                                                <label className="flex items-center gap-2 p-2 border border-slate-100 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItemData.barcode_display_value !== false}
                                                        onChange={(e) => updateSelectedItem('barcode_display_value', e.target.checked)}
                                                        className="rounded text-orange-600 focus:ring-orange-500"
                                                    />
                                                    <span className="text-xs text-slate-600">Metni Göster</span>
                                                </label>
                                            </>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Font Boyutu</label>
                                                <input
                                                    type="number"
                                                    value={selectedItemData.font_size}
                                                    onChange={(e) => updateSelectedItem('font_size', parseInt(e.target.value) || 12)}
                                                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Satır Sayısı</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={selectedItemData.max_lines || 1}
                                                    onChange={(e) => updateSelectedItem('max_lines', parseInt(e.target.value) || 1)}
                                                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                />
                                                {(() => {
                                                    const estimatedLines = calculateEstimatedLines(selectedItemData);
                                                    const maxLines = selectedItemData.max_lines || 1;
                                                    const isOverflow = estimatedLines > maxLines;
                                                    const isTight = estimatedLines === maxLines;
                                                    const color = isOverflow ? 'text-red-600' : isTight ? 'text-orange-600' : 'text-green-600';

                                                    return (
                                                        <p className={`text-[10px] ${color} mt-1 font-medium`}>
                                                            Tahmini: ~{estimatedLines} satır {isOverflow && '⚠️ Taşıyor!'}
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Hizalama</label>
                                                <div className="flex bg-slate-100 rounded-lg p-1">
                                                    {['left', 'center', 'right'].map(align => (
                                                        <button
                                                            key={align}
                                                            onClick={() => updateSelectedItem('text_align', align)}
                                                            className={`flex-1 p-1 rounded ${selectedItemData.text_align === align ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`}
                                                        >
                                                            <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                                {align === 'left' && <path d="M4 6h16M4 12h10M4 18h8" />}
                                                                {align === 'center' && <path d="M4 6h16M7 12h10M9 18h6" />}
                                                                {align === 'right' && <path d="M4 6h16M10 12h10M12 18h8" />}
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                            <span className="text-sm font-medium text-slate-700">Kalın Yazı (Bold)</span>
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedItemData.font_bold ? 'bg-orange-500' : 'bg-slate-200'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${selectedItemData.font_bold ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={selectedItemData.font_bold}
                                                onChange={(e) => updateSelectedItem('font_bold', e.target.checked)}
                                                className="hidden"
                                            />
                                        </label>
                                    </>
                                )}

                                {/* Delete Element Button */}
                                <div className="pt-4 border-t border-slate-200">
                                    <button
                                        onClick={handleDeleteItem}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors border border-red-200"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Nesneyi Sil
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <p className="text-sm font-medium">Düzenlemek için bir element seçin</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
