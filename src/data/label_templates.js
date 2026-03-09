export const PAPER_SIZES = {
    'Termal 30x60mm': {
        width: 227, // ~60mm in pixels at 96dpi
        height: 113, // ~30mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'Termal 50x30mm': {
        width: 189, // ~50mm
        height: 113, // ~30mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'Fiyat Yok Sadece Barkod 15x80': {
        width: 302, // 80mm
        height: 57, // 15mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'Fiyatlı 15x50': {
        width: 189, // 50mm
        height: 57, // 15mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'Fiyatlı Barkodlu 1,5 CM x 5 CM': {
        width: 189, // 50mm
        height: 57, // 15mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'Fiyatlı Barkodlu 1,5 CM x 5 CM (Kopya)': {
        width: 189, // 50mm
        height: 57, // 15mm
        type: 'thermal',
        labelsPerRow: 1,
        rowsPerPage: 1
    },
    'A4 Standart (3x7)': {
        width: 794, // 210mm
        height: 1123, // 297mm
        type: 'a4',
        labelsPerRow: 3,
        rowsPerPage: 7,
        marginTop: 40,
        marginLeft: 20,
        horizontalGap: 10,
        verticalGap: 0,
        labelWidth: 240, // 63.5mm
        labelHeight: 144 // 38.1mm
    },
    'A4 Raf Etiketi (2x4)': {
        width: 794,
        height: 1123,
        type: 'a4',
        labelsPerRow: 2,
        rowsPerPage: 4,
        marginTop: 50,
        marginLeft: 50,
        horizontalGap: 50,
        verticalGap: 50,
        labelWidth: 320,
        labelHeight: 220
    }
};

export const AVAILABLE_VARIABLES = [
    { key: '{{URUN_ADI}}', label: 'Ürün Adı', sample: 'Örnek Ürün' },
    { key: '{{FIYAT}}', label: 'Fiyat', sample: '129.90' },
    { key: '{{BARKOD}}', label: 'Barkod', sample: '8690123456789' },
    { key: '{{BARKOD_NO}}', label: 'Barkod Numarası (Sayıyla)', sample: '8690123456789' },
    { key: '{{BARKOD_QR}}', label: 'QR Kod (Barkod)', sample: '8690123456789' },
    { key: '{{STOK_KODU}}', label: 'Stok Kodu', sample: 'STK001' },
    { key: '{{TARIH}}', label: 'Tarih', sample: '10.02.2026' },
    { key: '{{MARKA}}', label: 'Marka', sample: 'Örnek Marka' },
    { key: '{{GRUP}}', label: 'Grup', sample: 'Gıda' },
    { key: '{{PARA_BIRIMI}}', label: 'Para Birimi', sample: '₺' },
];

export const DEFAULT_TEMPLATES = {
    'Termal 30x60mm': {
        paper_size: 'Termal 30x60mm',
        items: [
            {
                type: 'text',
                id: 'name',
                x: 10,
                y: 10,
                width: 200,
                height: 40,
                text: '{{URUN_ADI}}',
                font_size: 14,
                font_bold: true,
                text_align: 'center',
                color: '#000000'
            },
            {
                type: 'text',
                id: 'price',
                x: 10,
                y: 55,
                width: 200,
                height: 30,
                text: '{{FIYAT}} {{PARA_BIRIMI}}',
                font_size: 24,
                font_bold: true,
                text_align: 'center',
                color: '#000000'
            },
            {
                type: 'text',
                id: 'barcode',
                x: 10,
                y: 90,
                width: 200,
                height: 15,
                text: '{{BARKOD}}',
                font_size: 10,
                font_family: 'monospace',
                text_align: 'center',
                color: '#000000'
            }
        ]
    },
    'A4 Standart (3x7)': {
        paper_size: 'A4 Standart (3x7)',
        items: [
            {
                type: 'text',
                id: 'name',
                x: 10,
                y: 10,
                width: 220,
                height: 60,
                text: '{{URUN_ADI}}',
                font_size: 16,
                font_bold: true,
                text_align: 'center',
                color: '#000000'
            },
            {
                type: 'text',
                id: 'price',
                x: 10,
                y: 80,
                width: 220,
                height: 40,
                text: '{{FIYAT}} {{PARA_BIRIMI}}',
                font_size: 32,
                font_bold: true,
                text_align: 'center',
                color: '#000000'
            }
        ]
    },
    'Fiyat Yok Sadece Barkod 15x80': {
        paper_size: 'Fiyat Yok Sadece Barkod 15x80',
        items: [
            {
                type: 'text',
                id: 'barcode',
                x: 5,
                y: 5,
                width: 290,
                height: 45,
                text: '{{BARKOD}}',
                font_size: 14,
                barcode_width: 2.5,
                barcode_height: 30,
                text_align: 'center',
                color: '#000000'
            }
        ]
    },
    'Fiyatlı 15x50': {
        paper_size: 'Fiyatlı 15x50',
        items: [
            {
                type: 'text',
                id: 'name',
                x: 5,
                y: 2,
                width: 180,
                height: 14,
                text: '{{URUN_ADI}}',
                font_size: 10,
                font_bold: true,
                text_align: 'left',
                color: '#000000',
                max_lines: 1
            },
            {
                type: 'text',
                id: 'price',
                x: 5,
                y: 18,
                width: 100,
                height: 20,
                text: '{{FIYAT}} {{PARA_BIRIMI}}',
                font_size: 14,
                font_bold: true,
                text_align: 'left',
                color: '#000000'
            },
            {
                type: 'text',
                id: 'barcode',
                x: 100,
                y: 16,
                width: 85,
                height: 25,
                text: '{{BARKOD}}',
                font_size: 10,
                barcode_width: 1.5,
                barcode_height: 20,
                text_align: 'right',
                color: '#000000',
                barcode_display_value: false
            }
        ]
    },
    'Fiyatlı Barkodlu 1,5 CM x 5 CM': {
        paper_size: 'Fiyatlı Barkodlu 1,5 CM x 5 CM',
        items: [
            {
                type: 'text',
                id: 'var_1770817679552',
                x: 25,
                y: 0,
                width: 119,
                height: 10,
                text: '{{URUN_ADI}}',
                font_family: 'Inter, sans-serif',
                font_size: 8,
                font_bold: true,
                font_style: 'semi-condensed',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817682088',
                x: 66,
                y: 42,
                width: 92,
                height: 13,
                text: '{{FIYAT}}',
                font_family: 'Inter, sans-serif',
                font_size: 12,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'right',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817687112',
                x: 120,
                y: 41,
                width: 120,
                height: 13,
                text: '{{PARA_BIRIMI}}',
                font_family: 'Inter, sans-serif',
                font_size: 12,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770819375952',
                x: 20,
                y: 12,
                width: 113,
                height: 17,
                text: '{{BARKOD}}',
                font_size: 14,
                font_bold: false,
                font_style: 'normal',
                color: '#000000',
                text_align: 'center',
                is_barcode: true,
                is_qrcode: false,
                max_lines: 1,
                barcode_width: 2,
                barcode_height: 29,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817692504',
                x: 4,
                y: 43,
                width: 91,
                height: 10,
                text: '{{TARIH}}',
                font_family: 'Inter, sans-serif',
                font_size: 9,
                font_bold: true,
                font_style: 'semi-condensed-italic',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817699088',
                x: 47,
                y: 26,
                width: 120,
                height: 17,
                text: '{{STOK_KODU}}',
                font_family: 'Tahoma, sans-serif',
                font_size: 13,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            }
        ]
    },
    'Fiyatlı Barkodlu 1,5 CM x 5 CM (Kopya)': {
        paper_size: 'Fiyatlı Barkodlu 1,5 CM x 5 CM (Kopya)',
        items: [
            {
                type: 'text',
                id: 'var_1770817679552',
                x: 25,
                y: 0,
                width: 119,
                height: 10,
                text: '{{URUN_ADI}}',
                font_family: 'Inter, sans-serif',
                font_size: 8,
                font_bold: true,
                font_style: 'semi-condensed',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817682088',
                x: 66,
                y: 42,
                width: 92,
                height: 13,
                text: '{{FIYAT}}',
                font_family: 'Inter, sans-serif',
                font_size: 12,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'right',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817687112',
                x: 120,
                y: 41,
                width: 120,
                height: 13,
                text: '{{PARA_BIRIMI}}',
                font_family: 'Inter, sans-serif',
                font_size: 12,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770819375952',
                x: 20,
                y: 12,
                width: 113,
                height: 17,
                text: '{{BARKOD}}',
                font_size: 14,
                font_bold: false,
                font_style: 'normal',
                color: '#000000',
                text_align: 'center',
                is_barcode: true,
                is_qrcode: false,
                max_lines: 1,
                barcode_width: 2,
                barcode_height: 29,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817692504',
                x: 4,
                y: 43,
                width: 91,
                height: 10,
                text: '{{TARIH}}',
                font_family: 'Inter, sans-serif',
                font_size: 9,
                font_bold: true,
                font_style: 'semi-condensed-italic',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            },
            {
                type: 'text',
                id: 'var_1770817699088',
                x: 47,
                y: 26,
                width: 120,
                height: 17,
                text: '{{STOK_KODU}}',
                font_family: 'Tahoma, sans-serif',
                font_size: 13,
                font_bold: true,
                font_style: 'normal',
                color: '#000000',
                text_align: 'left',
                is_barcode: false,
                is_qrcode: false,
                max_lines: 1,
                barcode_display_value: false
            }
        ]
    }
};
