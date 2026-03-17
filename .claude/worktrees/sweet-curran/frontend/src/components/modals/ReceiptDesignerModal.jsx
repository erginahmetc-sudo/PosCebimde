import { useState, useEffect, useRef } from 'react';

const PAPER_SIZES = {
    'A5 (148x210mm)': { width: '148mm', height: '210mm' },
};

import { settingsAPI } from '../../services/api';
import StatusModal from './StatusModal';

export default function ReceiptDesignerModal({ isOpen, onClose }) {
    const [companyInfo, setCompanyInfo] = useState({
        name: 'Firma Adı',
        address: '',
        phone: '',
        logo_text: 'K'
    });

    const [showWatermark, setShowWatermark] = useState(true);
    const [statusModal, setStatusModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

    useEffect(() => {
        if (isOpen) {
            // 1. Try to load saved config from LocalStorage
            const savedConfig = localStorage.getItem('receipt_design_config');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    setCompanyInfo(prev => ({ ...prev, ...parsed }));
                    if (parsed.showWatermark !== undefined) setShowWatermark(parsed.showWatermark);
                } catch (e) {
                    console.error("Error loading receipt config", e);
                }
            } else {
                // 2. If no saved config, fetch Company Info from API (Settings)
                // This ensures new users get the "Default Company Info" instead of placeholders
                fetchCompanySettings();
            }
        }
    }, [isOpen]);

    const fetchCompanySettings = async () => {
        try {
            const nameRes = await settingsAPI.get('company_name');
            const addressRes = await settingsAPI.get('company_address');
            const phoneRes = await settingsAPI.get('company_phone');
            const logoRes = await settingsAPI.get('company_logo');

            setCompanyInfo(prev => ({
                ...prev,
                name: nameRes.data || prev.name,
                address: addressRes.data || prev.address,
                phone: phoneRes.data || prev.phone,
                logo_url: logoRes.data || undefined,
                logo_text: (nameRes.data || prev.name).charAt(0).toUpperCase()
            }));
        } catch (error) {
            console.error("Error fetching company settings for receipt default:", error);
        }
    };

    const handleSave = () => {
        const config = {
            ...companyInfo,
            showWatermark,
            type: 'custom_html_a5'
        };
        localStorage.setItem('receipt_design_config', JSON.stringify(config));
        // Also ensure we set the flag for printing logic to know to use this
        localStorage.setItem('receipt_template_type', 'custom_html_a5');
        setStatusModal({
            isOpen: true,
            title: 'Başarılı',
            message: 'Tasarım ayarları kaydedildi!',
            type: 'success'
        });
    };

    const getPreviewHTML = () => {
        const saleData = {
            customer: 'Örnek Müşteri T.',
            items: []
        };

        return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
    <style type="text/tailwindcss">
        :root {
            --primary-color: #000000;
            --print-width: 148mm;
            --print-height: 210mm;
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
            display: ${showWatermark ? 'block' : 'none'};
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
<body class="bg-white overflow-hidden m-0 p-0">
    <div class="a5-container relative flex flex-col">
        <div class="watermark">
            <span class="material-symbols-outlined text-[300px]">construction</span>
        </div>
        <header class="relative z-10 flex justify-between items-start mb-0.5 px-2 pt-0">
            <!-- Left: Date/Time -->
            <div class="w-[15%] text-left">
                <div class="flex flex-col items-center w-fit">
                    <div class="text-lg font-bold text-black tracking-tighter leading-none">24.05.2024</div>
                    <div class="text-lg font-bold text-black tracking-tighter leading-none">14:32</div>
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
                    <tr>
                        <td class="font-medium text-black">
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-8 h-8 bg-white border border-black rounded flex items-center justify-center overflow-hidden">
                                    <img src="https://via.placeholder.com/150" class="w-full h-full object-contain" alt="Preview" />
                                </div>
                                <span class="truncate block">{'Örnek Ürün - Matkap Ucu'.substring(0, 36)}</span>
                            </div>
                        </td>
                        <td class="text-center text-black">1 Ad.</td>
                        <td class="text-right text-black">245.00 TL</td>
                        <td class="text-right font-bold text-black">245.00 TL</td>
                    </tr>
                    <tr>
                        <td class="font-medium text-black">
                             <div class="flex items-center gap-2">
                                <div class="w-8 h-8 bg-white border border-black rounded flex items-center justify-center overflow-hidden">
                                    <img src="https://via.placeholder.com/150" class="w-full h-full object-contain" alt="Preview" />
                                </div>
                                <span>Örnek Ürün - Boya</span>
                            </div>
                        </td>
                        <td class="text-center text-black">2 Ad.</td>
                        <td class="text-right text-black">850.00 TL</td>
                        <td class="text-right font-bold text-black">1,700.00 TL</td>
                    </tr>
                </tbody>
            </table>
        </main>
        <footer class="relative z-10 pt-2 border-t border-slate-100">
            <div class="flex justify-end items-end">
                <div class="bg-slate-50 rounded-xl p-2 border border-slate-100 shadow-sm">
                    <div class="flex items-center gap-4">
                        <span class="text-xs text-black font-bold uppercase tracking-wider">GENEL TOPLAM</span>
                        <span class="text-2xl font-black text-black">1,945.00 TL</span>
                    </div>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>
        `;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl">receipt_long</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Fiş Tasarımcısı (A5)</h2>
                            <p className="text-white/70 text-sm">A5 Fiş şablonunu özelleştirin</p>
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
                    {/* Left Panel - Settings */}
                    <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto">

                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Firma Bilgileri</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Firma Adı</label>
                                    <input
                                        type="text"
                                        value={companyInfo.name}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="Firma Adı"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Adres</label>
                                    <textarea
                                        value={companyInfo.address}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        rows={3}
                                        placeholder="Adres Bilgisi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Telefon</label>
                                    <input
                                        type="text"
                                        value={companyInfo.phone}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="İletişim No"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Logo Harfi/Sembol</label>
                                    <input
                                        type="text"
                                        maxLength={2}
                                        value={companyInfo.logo_text}
                                        onChange={(e) => setCompanyInfo({ ...companyInfo, logo_text: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="E"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Görünüm</h3>
                            <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showWatermark}
                                    onChange={(e) => setShowWatermark(e.target.checked)}
                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <span className="text-sm font-medium text-slate-700">Fonda Filigran Göster</span>
                            </label>
                        </div>

                        <div className="mt-auto">
                            <button
                                onClick={handleSave}
                                className="w-full px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">save</span>
                                Ayarları Kaydet
                            </button>
                        </div>
                    </div>

                    {/* Right Panel - Preview */}
                    <div className="flex-1 bg-slate-200/50 p-4 flex items-start justify-center overflow-auto">
                        <div className="shadow-2xl rounded-sm bg-white overflow-hidden" style={{ width: '133.2mm', height: '189mm' }}>
                            <div style={{ width: '148mm', height: '210mm', transform: 'scale(0.9)', transformOrigin: '0 0' }}>
                                <iframe
                                    srcDoc={getPreviewHTML()}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        backgroundColor: 'white'
                                    }}
                                    title="Receipt Preview"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => setStatusModal(prev => ({...prev, isOpen: false}))}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />
        </div>
    );
}
