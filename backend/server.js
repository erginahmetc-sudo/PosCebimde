const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) {
        console.warn("WARNING: Invalid or missing SUPABASE_URL. Backend API may fail.");
    } else {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase client initialized successfully.");
    }
} catch (error) {
    console.error("Failed to initialize Supabase client:", error.message);
}

// Admin Client (RLS bypass - Service Role Key ile)
let adminSupabase = null;
try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (SERVICE_KEY && SUPABASE_URL) {
        adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log("Admin Supabase client initialized (Service Role).");
    } else {
        adminSupabase = supabase;
        console.log("Service Role Key not found, falling back to standard client for admin ops.");
    }
} catch (e) {
    console.error("Admin client init failed", e);
}

app.use(cors());
app.use(express.json());

// --- HELPER: BirFatura Token Doğrulama (Tüm endpointler için ortak) ---
const FALLBACK_TOKENS = [
    'poscebimde-2026-secret-api-token',
    'kasapos-2026-secret-api-token' // Geriye uyumluluk
];

async function validateBirFaturaToken(receivedToken) {
    if (!receivedToken) {
        return { valid: false, companyCode: null, reason: 'Token eksik' };
    }

    // RLS bypass için adminSupabase kullan
    const dbClient = adminSupabase || supabase;
    if (!dbClient) {
        return { valid: false, companyCode: null, reason: 'Veritabanı bağlantısı yok' };
    }

    // A) Veritabanından secret_token kontrolü
    try {
        const { data: settings, error: tokenError } = await dbClient
            .from('app_settings')
            .select('company_code, value')
            .eq('key', 'secret_token');

        if (tokenError) {
            console.error("[Token] Sorgulama hatası:", tokenError);
        }

        if (settings && settings.length > 0) {
            for (const setting of settings) {
                if (setting.value) {
                    let storedToken = setting.value;
                    if (typeof storedToken === 'string') {
                        storedToken = storedToken.replace(/^"|"$/g, '');
                    }
                    if (storedToken === receivedToken) {
                        console.log(`[Token] DB token eşleşti (company: ${setting.company_code})`);
                        return { valid: true, companyCode: setting.company_code };
                    }
                }
            }
            console.warn(`[Token] DB'de ${settings.length} token bulundu ama hiçbiri eşleşmedi.`);
        } else {
            console.warn("[Token] DB'de secret_token kaydı bulunamadı.");
        }
    } catch (e) {
        console.error("[Token] DB sorgu hatası:", e.message);
    }

    // B) Fallback token kontrolü
    if (FALLBACK_TOKENS.includes(receivedToken)) {
        console.log("[Token] Fallback token kabul edildi.");
        return { valid: true, companyCode: null };
    }

    return { valid: false, companyCode: null, reason: 'Geçersiz token' };
}

// --- BIRFATURA API PROXY ---
app.post('/api/birfatura-proxy', async (req, res) => {
    try {
        const { endpoint, payload, apiKey, secretKey, integrationKey } = req.body;

        if (!endpoint || !apiKey || !secretKey || !integrationKey) {
            return res.status(400).json({
                Success: false,
                Message: 'Eksik parametre: endpoint, apiKey, secretKey ve integrationKey gerekli.'
            });
        }

        const url = `https://uygulama.edonustur.com/api/${endpoint}`;

        const headers = {
            "X-Api-Key": apiKey,
            "X-Secret-Key": secretKey,
            "X-Integration-Key": integrationKey,
            "Content-Type": "application/json"
        };

        console.log(`[BirFatura Proxy] POST ${url}`);
        console.log(`[BirFatura Proxy] Payload:`, JSON.stringify(payload, null, 2));

        const response = await axios.post(url, payload, {
            headers,
            timeout: 30000
        });

        console.log(`[BirFatura Proxy] Response:`, JSON.stringify(response.data, null, 2));
        res.json(response.data);
    } catch (error) {
        console.error('[BirFatura Proxy] Error:', error.message);
        if (error.response) {
            console.error('[BirFatura Proxy] Error Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('[BirFatura Proxy] Error Status:', error.response.status);
        }

        if (error.response) {
            res.status(error.response.status).json(error.response.data || {
                Success: false,
                Message: error.message,
                StatusCode: error.response.status
            });
        } else {
            res.status(500).json({
                Success: false,
                Message: 'BirFatura API\'ye bağlanılamadı: ' + error.message
            });
        }
    }
});

// --- HELPER: Date Parsing (BirFatura format: DD.MM.YYYY HH:mm:ss) ---
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length < 2) return null;
    const dateParts = parts[0].split('.');
    const timeParts = parts[1].split(':');
    if (dateParts.length < 3) return null;
    const d = new Date(
        parseInt(dateParts[2], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[0], 10),
        parseInt(timeParts[0] || 0, 10),
        parseInt(timeParts[1] || 0, 10),
        parseInt(timeParts[2] || 0, 10)
    );
    return isNaN(d.getTime()) ? null : d;
}

// --- HELPER: Format Date to BirFatura format ---
function formatDateForBirFatura(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "01.01.2026 00:00:00";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

// --- HELPER: Ödeme yöntemi eşleştirme ---
function mapPaymentMethodToId(method) {
    if (!method) return { id: 1, value: "Kredi Kartı" };
    const m = method.toLowerCase();
    if (m.includes('nakit')) return { id: 5, value: "Nakit" };
    if (m.includes('havale') || m.includes('eft')) return { id: 2, value: "Banka EFT-Havale" };
    if (m.includes('kapıda') && m.includes('nakit')) return { id: 3, value: "Kapıda Ödeme Nakit" };
    if (m.includes('kapıda')) return { id: 4, value: "Kapıda Ödeme Kredi Kartı" };
    return { id: 1, value: "Kredi Kartı" };
}

// --- ENDPOINT: BirFatura Order Statuses ---
// NOT: Basit token varlık kontrolü - eski çalışan mantık (DB sorgusu yapmıyor)
app.post('/api/orderStatus/', (req, res) => {
    const receivedToken = req.headers['token'];
    if (!receivedToken) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
    console.log("[orderStatus] Token mevcut, statüler döndürülüyor.");
    res.json({
        OrderStatus: [
            { Id: 1, Value: "Onaylandı" },
            { Id: 2, Value: "Kargolandı" },
            { Id: 3, Value: "İptal Edildi" }
        ]
    });
});

// --- ENDPOINT: BirFatura Payment Methods ---
// NOT: Basit token varlık kontrolü - eski çalışan mantık
app.post('/api/paymentMethods/', (req, res) => {
    const receivedToken = req.headers['token'];
    if (!receivedToken) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
    console.log("[paymentMethods] Token mevcut, ödeme yöntemleri döndürülüyor.");
    res.json({
        PaymentMethods: [
            { Id: 1, Value: "Kredi Kartı" },
            { Id: 2, Value: "Banka EFT-Havale" },
            { Id: 3, Value: "Kapıda Ödeme Nakit" },
            { Id: 4, Value: "Kapıda Ödeme Kredi Kartı" },
            { Id: 5, Value: "Nakit" }
        ]
    });
});

// --- ENDPOINT: BirFatura Cargo Update ---
// NOT: Swagger spec 200 (empty) diyor - eski çalışan mantık
app.post('/api/orderCargoUpdate/', (req, res) => {
    console.log("[orderCargoUpdate] İstek alındı:", JSON.stringify(req.body));
    res.status(200).send();
});

// --- ENDPOINT: BirFatura Invoice Link Update ---
// NOT: Swagger spec 200 (empty) diyor - eski çalışan mantık
app.post('/api/invoiceLinkUpdate/', (req, res) => {
    console.log("[invoiceLinkUpdate] İstek alındı:", JSON.stringify(req.body));
    res.status(200).send();
});



// --- ENDPOINT: Force Delete Product (Fix Stuck Stock Codes) ---
app.post('/api/products/force-delete', async (req, res) => {
    const { stockCode } = req.body;

    if (!stockCode) {
        return res.status(400).json({ success: false, message: 'Stok kodu gereklidir.' });
    }

    console.log(`[Force Delete] Attempting to delete product with stock_code: ${stockCode}`);

    const client = adminSupabase || supabase;

    const { data: existing, error: findError } = await client
        .from('products')
        .select('id, stock_code')
        .eq('stock_code', stockCode);

    if (findError) {
        console.error('[Force Delete] Find error:', findError);
        return res.status(500).json({ success: false, message: findError.message });
    }

    try {
        const { error: delError, count } = await client
            .from('products')
            .delete()
            .eq('stock_code', stockCode);

        if (delError) {
            console.warn('[Force Delete] Delete failed, trying rename. Error:', delError.message);

            const newCode = `${stockCode}_DEL_${Math.floor(Date.now() / 1000)}`;
            const { error: updError } = await client
                .from('products')
                .update({ stock_code: newCode })
                .eq('stock_code', stockCode);

            if (updError) {
                return res.status(500).json({ success: false, message: 'Silme ve yeniden adlandırma başarısız: ' + updError.message });
            }

            return res.json({ success: true, message: `Kayıt silinemedi (bağlı veri) ama ${newCode} olarak yeniden adlandırıldı.` });
        }

        return res.json({ success: true, message: 'Kayıt başarıyla silindi.' });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// BirFatura Sipariş Endpoint - Swagger Spec'e TAM UYUMLU
// =====================================================
async function handleBirFaturaOrders(req, res) {
    const receivedToken = req.headers['token'];
    console.log("[orders] ====== BirFatura Sipariş İsteği ======");
    console.log("[orders] Body:", JSON.stringify(req.body));
    console.log("[orders] Token:", receivedToken ? receivedToken.substring(0, 8) + '...' : 'YOK');

    // 1. Token doğrulama - önce basit kontrol, sonra DB
    if (!receivedToken) {
        console.error("[orders] Token YOK");
        return res.status(401).json({ "Orders": [], "error": "Token eksik" });
    }

    let companyCode = null;
    // DB doğrulama dene, başarısız olursa token varlığı yeterli
    try {
        const tokenResult = await validateBirFaturaToken(receivedToken);
        if (tokenResult.valid) {
            companyCode = tokenResult.companyCode;
            console.log(`[orders] Token DB'de doğrulandı (company: ${companyCode || 'fallback'})`);
        } else {
            // DB doğrulama başarısız ama token var, yine de devam et
            console.warn(`[orders] DB token doğrulaması başarısız (${tokenResult.reason}), token var - devam ediliyor`);
        }
    } catch (e) {
        console.warn(`[orders] Token doğrulama hatası: ${e.message}, token var - devam ediliyor`);
    }

    if (!supabase) {
        console.error("[orders] Supabase not initialized.");
        return res.status(503).json({ "Orders": [], "error": "Veritabanı bağlantısı yok" });
    }

    // 2. Request body parse
    const filterData = req.body || {};
    const startDateTimeStr = filterData.startDateTime;
    const endDateTimeStr = filterData.endDateTime;
    const orderCodeFilter = filterData.OrderCode;
    const requestedOrderStatusId = parseInt(filterData.orderStatusId) || 0;

    console.log(`[orders] Filtreler - orderStatusId: ${requestedOrderStatusId}, start: ${startDateTimeStr}, end: ${endDateTimeStr}, OrderCode: ${orderCodeFilter || 'yok'}`);

    // Sadece "Onaylandı" (status 1) için sipariş döndür
    // Diğer statusler (2=Kargolandı, 3=İptal) için boş dön
    if (requestedOrderStatusId !== 0 && requestedOrderStatusId !== 1) {
        console.log(`[orders] Status ${requestedOrderStatusId} istendi - boş döndürülüyor (sadece 1=Onaylandı desteklenir)`);
        return res.json({ "Orders": [] });
    }

    // 3. Fetch Sales - RPC fonksiyonu ile (RLS bypass, SECURITY DEFINER)
    // NOT: Direkt tablo sorgusu anon key ile RLS'ye takılıyor!
    // Bu yüzden get_birfatura_sales() RPC fonksiyonu kullanılıyor.
    console.log("[orders] RPC fonksiyonu çağrılıyor: get_birfatura_sales");

    let sales = [];
    let error = null;

    try {
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('get_birfatura_sales', { p_token: receivedToken });

        if (rpcError) {
            console.error("[orders] RPC Hatası:", JSON.stringify(rpcError));
            error = rpcError;
        } else {
            // RPC jsonb array döndürür
            sales = Array.isArray(rpcResult) ? rpcResult : [];
            console.log(`[orders] RPC'den ${sales.length} satış döndü.`);
        }
    } catch (e) {
        console.error("[orders] RPC çağrı hatası:", e.message);
        // Fallback: direkt sorgu dene (service role key varsa çalışır)
        console.log("[orders] Fallback: direkt tablo sorgusu deneniyor...");
        const dbClient = adminSupabase || supabase;
        let query = dbClient.from('sales').select('*').eq('is_deleted', false);
        if (companyCode) query = query.eq('company_code', companyCode);
        if (orderCodeFilter) query = query.eq('sale_code', orderCodeFilter);
        const result = await query;
        sales = result.data || [];
        error = result.error;
    }

    // OrderCode filtresi (RPC sonrası uygula)
    if (orderCodeFilter && sales.length > 0) {
        sales = sales.filter(s => s.sale_code === orderCodeFilter);
    }

    // Ürünlerin vat_rate bilgisini RPC ile çek
    let productsVatMap = {};
    try {
        const { data: productsData } = await supabase
            .rpc('get_birfatura_products_vat', { p_token: receivedToken });
        if (productsData && Array.isArray(productsData)) {
            for (const p of productsData) {
                if (p.stock_code) productsVatMap[p.stock_code] = p.vat_rate || 20;
                if (p.id) productsVatMap[String(p.id)] = p.vat_rate || 20;
            }
            console.log(`[orders] ${Object.keys(productsVatMap).length} ürün KDV oranı yüklendi (RPC).`);
        }
    } catch (e) {
        console.warn("[orders] Ürün KDV oranları çekilemedi:", e.message);
    }

    if (error) {
        console.error("[orders] Supabase Hatası:", JSON.stringify(error));
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası: " + (error.message || JSON.stringify(error)) });
    }

    console.log(`[orders] Toplam ${sales.length} satış işlenecek.`);
    if (sales.length > 0) {
        console.log(`[orders] İlk satış: id=${sales[0].id}, sale_code=${sales[0].sale_code}, date=${sales[0].date}, items_type=${typeof sales[0].items}, items_count=${Array.isArray(sales[0].items) ? sales[0].items.length : 'N/A'}`);
    } else {
        console.warn("[orders] UYARI: Hiç satış bulunamadı! RPC fonksiyonu Supabase'de oluşturulmuş mu?");
    }

    // 4. Process and Filter
    const ordersToSend = [];

    let filterStartDate = null, filterEndDate = null;
    if (startDateTimeStr && endDateTimeStr) {
        try {
            filterStartDate = parseDate(startDateTimeStr);
            filterEndDate = parseDate(endDateTimeStr);
            console.log(`[orders] Tarih filtresi: ${filterStartDate?.toISOString()} - ${filterEndDate?.toISOString()}`);
        } catch (e) {
            console.error("[orders] Tarih parse hatası:", e);
        }
    }

    for (const sale of (sales || [])) {
        // Tarih filtresi
        if (!orderCodeFilter && filterStartDate && filterEndDate) {
            try {
                const saleDate = new Date(sale.date || sale.created_at);
                if (isNaN(saleDate.getTime())) {
                    console.warn(`[orders] Geçersiz tarih, satış atlanıyor: ${sale.sale_code}`);
                    continue;
                }
                if (saleDate < filterStartDate || saleDate > filterEndDate) continue;
            } catch (e) {
                console.warn(`[orders] Tarih karşılaştırma hatası: ${sale.sale_code}`, e.message);
                continue;
            }
        }

        // --- Items Parse ---
        let items = sale.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }

        // Boş sipariş gönderme - BirFatura OrderDetails zorunlu ve dolu olmalı
        if (!Array.isArray(items) || items.length === 0) {
            console.warn(`[orders] Ürünsüz satış atlanıyor: ${sale.sale_code}`);
            continue;
        }

        // --- Customer & Tax Logic ---
        // customer_name alanı DB'de var, customer alanı yok
        const customerName = sale.customer_name || 'Misafir Müşteri';

        let ssnTcNo = "";
        let taxNo = "";
        let rawTax = sale.tax_number || "";

        if (rawTax.length === 11) {
            ssnTcNo = rawTax;
        } else if (rawTax.length > 0) {
            taxNo = rawTax;
        }

        if (!ssnTcNo && !taxNo && (customerName === 'Misafir Müşteri' || customerName === 'Toptan Satış')) {
            ssnTcNo = '11111111111';
        }

        let address = sale.address || "Fatih Mh.";
        let phone = sale.phone || "";
        let city = sale.city || "Adana";
        let district = sale.district || "Seyhan";
        let email = sale.email || "";
        let taxOffice = sale.tax_office || "";

        // --- Ödeme yöntemi eşleştirme ---
        const payment = mapPaymentMethodToId(sale.payment_method);

        // --- Items Logic ---
        let calculatedTotal = 0;
        const orderDetails = [];

        items.forEach(item => {
            // *** KRİTİK: VatRate INTEGER olmalı (Swagger spec: integer) ***
            // Items'da vat_rate genelde yok - products tablosundan çek
            let vatRateRaw = item.vat_rate || item.kdv;
            if (!vatRateRaw && item.stock_code) {
                vatRateRaw = productsVatMap[item.stock_code];
            }
            if (!vatRateRaw && item.id) {
                vatRateRaw = productsVatMap[String(item.id)];
            }
            const vatRate = parseInt(vatRateRaw || 20, 10);
            const unitPriceInclTax = parseFloat(item.price || item.final_price || 0);
            const quantity = parseFloat(item.quantity || 1);
            const unitPriceExclTax = vatRate > 0 ? unitPriceInclTax / (1 + vatRate / 100) : unitPriceInclTax;

            // İndirim hesaplama
            const discountRate = parseFloat(item.discount_rate || 0);
            const lineTotal = unitPriceInclTax * quantity;
            const discountInclTax = lineTotal * discountRate / 100;
            const discountExclTax = vatRate > 0 ? discountInclTax / (1 + vatRate / 100) : discountInclTax;

            // Birim başına indirim
            const discountUnitInclTax = quantity > 0 ? discountInclTax / quantity : 0;
            const discountUnitExclTax = quantity > 0 ? discountExclTax / quantity : 0;

            calculatedTotal += lineTotal - discountInclTax;

            // ProductId: long olmalı - UUID ise hash'le
            let productId = parseInt(item.id, 10);
            if (isNaN(productId) && item.id) {
                // UUID → hash
                let h = 0;
                for (let i = 0; i < item.id.length; i++) {
                    h = ((h << 5) - h) + item.id.charCodeAt(i);
                    h = h & 0x7FFFFFFF;
                }
                productId = h || 1;
            }
            orderDetails.push({
                "ProductId": productId || 0,
                "ProductCode": item.stock_code || item.code || "URUN01",
                "Barcode": item.barcode || item.stock_code || "",
                "ProductBrand": item.brand || "",
                "ProductName": item.name || "Ürün",
                "ProductNote": item.note || "",
                "ProductImage": item.image_url || item.image || "",
                "ProductQuantityType": item.unit || "Adet",
                "ProductQuantity": quantity,
                "VatRate": vatRate,
                "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                "CommissionUnitTaxExcluding": 0,
                "CommissionUnitTaxIncluding": 0,
                "DiscountUnitTaxExcluding": Number(discountUnitExclTax.toFixed(4)),
                "DiscountUnitTaxIncluding": Number(discountUnitInclTax.toFixed(4)),
                "Variants": [],
                "ExtraFeesUnit": []
            });
        });

        // İndirim toplamları
        const totalDiscountInclTax = orderDetails.reduce((sum, d) => sum + (d.DiscountUnitTaxIncluding * d.ProductQuantity), 0);
        const totalDiscountExclTax = orderDetails.reduce((sum, d) => sum + (d.DiscountUnitTaxExcluding * d.ProductQuantity), 0);

        // Genel toplam hesaplama
        const calculatedTotalExclTax = orderDetails.reduce((sum, d) => sum + (d.ProductUnitPriceTaxExcluding * d.ProductQuantity), 0) - totalDiscountExclTax;

        const saleDateObj = new Date(sale.date || sale.created_at);
        const formattedDate = formatDateForBirFatura(saleDateObj);

        // *** KRİTİK: OrderId long integer olmalı (Swagger: long) ***
        // sale.id muhtemelen UUID, BirFatura long integer bekliyor
        // sale_code formatı: SLS-1715000000000 → timestamp kısmını kullan
        let orderId = 0;
        if (sale.sale_code && sale.sale_code.includes('-')) {
            const parts = sale.sale_code.split('-');
            const numericPart = parts[parts.length - 1];
            const parsed = parseInt(numericPart, 10);
            if (!isNaN(parsed) && parsed > 0) {
                // Timestamp çok büyük olabilir, son 9 haneyi al (long'a sığar)
                orderId = parsed % 1000000000;
            }
        }
        if (orderId === 0 && typeof sale.id === 'number') {
            orderId = sale.id;
        }
        if (orderId === 0) {
            // Fallback: sale_code'dan hash üret
            let hash = 0;
            const str = sale.sale_code || sale.id?.toString() || '0';
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & 0x7FFFFFFF; // Pozitif tut
            }
            orderId = hash || 1;
        }

        // BirFatura sipariş objesi
        // NOT: BirFatura .NET backend'i null koleksiyonlarda patlar,
        // bu yüzden tüm dizi alanları boş bile olsa [] olarak gönderilmeli
        const shippingTaxNumber = taxNo ? taxNo : ssnTcNo;

        ordersToSend.push({
            "OrderId": orderId,
            "OrderCode": sale.sale_code || `S-${orderId}`,
            "OrderDate": formattedDate,
            "Status": 1,
            "OrderStatusId": 1,
            "CustomerId": 0,
            "BillingName": customerName,
            "BillingAddress": address,
            "BillingTown": district,
            "BillingCity": city,
            "BillingMobilePhone": phone,
            "BillingPhone": phone,
            "BillingTaxOffice": taxOffice,
            "TaxOffice": taxOffice,
            "TaxNo": taxNo,
            "SSNTCNo": ssnTcNo,
            "Email": email,
            "ShippingId": 0,
            "ShippingName": customerName,
            "ShippingAddress": address,
            "ShippingTown": district,
            "ShippingCity": city,
            "ShippingCountry": "Türkiye",
            "ShippingZipCode": "",
            "ShippingPhone": phone,
            "ShippingTaxNumber": shippingTaxNumber,
            "ShipCompany": "",
            "CargoCampaignCode": "",
            "SalesChannelWebSite": "",
            "PaymentTypeId": payment.id,
            "PaymentType": payment.value,
            "Currency": "TRY",
            "CurrencyRate": 1,
            "TotalPaidTaxIncluding": Number(calculatedTotal.toFixed(2)),
            "TotalPaidTaxExcluding": Number(calculatedTotalExclTax.toFixed(2)),
            "ProductsTotalTaxIncluding": Number(calculatedTotal.toFixed(2)),
            "ProductsTotalTaxExcluding": Number(calculatedTotalExclTax.toFixed(2)),
            "CommissionTotalTaxExcluding": 0,
            "CommissionTotalTaxIncluding": 0,
            "ShippingChargeTotalTaxExcluding": 0,
            "ShippingChargeTotalTaxIncluding": 0,
            "DiscountTotalTaxExcluding": Number(totalDiscountExclTax.toFixed(2)),
            "DiscountTotalTaxIncluding": Number(totalDiscountInclTax.toFixed(2)),
            "InstallmentChargeTotalTaxExcluding": 0,
            "InstallmentChargeTotalTaxIncluding": 0,
            "BankTransferDiscountTotalTaxExcluding": 0,
            "BankTransferDiscountTotalTaxIncluding": 0,
            "PayingAtTheDoorChargeTotalTaxExcluding": 0,
            "PayingAtTheDoorChargeTotalTaxIncluding": 0,
            "OrderDetails": orderDetails,
            "ExtraFees": []
        });
    }

    console.log(`[orders] BirFatura'ya ${ordersToSend.length} sipariş gönderiliyor.`);
    if (ordersToSend.length > 0) {
        console.log(`[orders] İlk sipariş (TAM):`);
        console.log(JSON.stringify(ordersToSend[0], null, 2));
    } else {
        console.log(`[orders] UYARI: Gönderilecek sipariş bulunamadı!`);
    }
    res.json({ "Orders": ordersToSend });
}

// Trailing slash'li ve slash'siz ikisi de aynı handler
app.post('/api/orders/', handleBirFaturaOrders);
app.post('/api/orders', handleBirFaturaOrders);

// --- SERVE STATIC FRONTEND (Production) ---
const frontendPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendPath)) {
    console.log("Serving static frontend from:", frontendPath);
    app.use(express.static(frontendPath));

    // SPA Fallback: Serve index.html for any unknown route NOT starting with /api
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            console.log(`[SPA Fallback] Serving index.html for: ${req.path}`);
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
} else {
    console.log("Frontend path not found:", frontendPath);
}

app.listen(PORT, () => {
    console.log(`PosCebimde Bridge Server running on port ${PORT}`);
});
