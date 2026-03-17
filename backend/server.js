const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
// app.py varsayılan olarak 5000 portunda çalıştığı için 5000 kullanıyoruz
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

// Admin Client for Force Deletes (Bypassing RLS if Service Role Key is available)
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
        // Fallback to normal client if no service key
        adminSupabase = supabase;
        console.log("Service Code not found, falling back to standard client for admin ops.");
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
            console.warn("[Token] DB'de secret_token kaydı bulunamadı (RLS veya kayıt yok).");
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
// Frontend'in CORS sorunu olmadan BirFatura API'sine erişmesi için proxy
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
            // BirFatura API'den gelen hata - tüm response'u gönder
            res.status(error.response.status).json(error.response.data || {
                Success: false,
                Message: error.message,
                StatusCode: error.response.status
            });
        } else {
            // Ağ hatası vb.
            res.status(500).json({
                Success: false,
                Message: 'BirFatura API\'ye bağlanılamadı: ' + error.message
            });
        }
    }
});

// --- HELPER: Date Parsing (BirFatura format: DD.MM.YYYY HH:mm:ss) ---
function parseDate(dateStr) {
    if (!dateStr) return null;
    // Format: DD.MM.YYYY HH:mm:ss
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('.');
    const timeParts = parts[1].split(':');
    return new Date(
        dateParts[2], dateParts[1] - 1, dateParts[0],
        timeParts[0], timeParts[1], timeParts[2]
    );
}

// --- HELPER: Format Date to BirFatura format ---
function formatDateForBirFatura(date) {
    const d = new Date(date);
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
    return { id: 1, value: "Kredi Kartı" }; // default
}

// --- ENDPOINT: BirFatura Order Statuses ---
// NOT: Basit token varlık kontrolü kullan. validateBirFaturaToken() DB sorgusu yapar,
// başarısız olursa BirFatura'nın .NET backend'i "Value cannot be null" hatası verir
// çünkü OrderStatus dizisini bekler ama 401 JSON alır.
app.post('/api/orderStatus/', async (req, res) => {
    const receivedToken = req.headers['token'];
    if (!receivedToken) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
    res.json({
        OrderStatus: [{ Id: 1, Value: "Onaylandı" }, { Id: 2, Value: "Kargolandı" }, { Id: 3, Value: "İptal Edildi" }]
    });
});

// --- ENDPOINT: BirFatura Payment Methods ---
app.post('/api/paymentMethods/', async (req, res) => {
    const receivedToken = req.headers['token'];
    if (!receivedToken) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
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
app.post('/api/orderCargoUpdate/', async (req, res) => {
    console.log(`[orderCargoUpdate] Body:`, JSON.stringify(req.body));
    res.status(200).send();
});

// --- ENDPOINT: BirFatura Invoice Link Update ---
app.post('/api/invoiceLinkUpdate/', async (req, res) => {
    console.log(`[invoiceLinkUpdate] Body:`, JSON.stringify(req.body));
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

    // 1. Try to fetch first
    const { data: existing, error: findError } = await client
        .from('products')
        .select('id, stock_code')
        .eq('stock_code', stockCode);

    if (findError) {
        console.error('[Force Delete] Find error:', findError);
        return res.status(500).json({ success: false, message: findError.message });
    }

    // Even if we don't 'see' it with select (if RLS hides it), we can try to delete blindly if we are admin.
    // However, delete().eq() behaves same as select for filters usually unless service role.

    try {
        // 2. Delete
        const { error: delError, count } = await client
            .from('products')
            .delete()
            .eq('stock_code', stockCode);

        if (delError) {
            // Attempt Rename if Delete fails (FK constraint)
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

        // If count is 0, maybe we didn't find it?
        // With service role, we should have found it.
        return res.json({ success: true, message: 'Kayıt başarıyla silindi.' });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// --- ENDPOINT: BirFatura Polls This for Orders ---
// BirFatura Swagger spec'ine tam uyumlu sipariş endpoint'i
// Trailing slash'li ve slash'siz ikisi de aynı handler
async function handleBirFaturaOrders(req, res) {
    const receivedToken = req.headers['token'];
    console.log("[orders] ====== BirFatura Sipariş İsteği ======");
    console.log("[orders] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[orders] Body:", JSON.stringify(req.body));
    console.log("[orders] Token:", receivedToken ? receivedToken.substring(0, 8) + '...' : 'YOK');

    // 1. Token doğrulama
    const tokenResult = await validateBirFaturaToken(receivedToken);
    if (!tokenResult.valid) {
        console.error(`[orders] Token BAŞARISIZ: ${tokenResult.reason}`);
        return res.status(401).json({ "Orders": [], "error": "Yetkisiz Erişim: " + tokenResult.reason });
    }
    console.log(`[orders] Token OK (company: ${tokenResult.companyCode || 'fallback'})`);

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

    // 3. Fetch Sales
    const dbClient = adminSupabase || supabase;
    let query = dbClient
        .from('sales')
        .select('*')
        .eq('is_deleted', false);

    if (tokenResult.companyCode) {
        query = query.eq('company_code', tokenResult.companyCode);
    }

    if (orderCodeFilter) {
        query = query.eq('sale_code', orderCodeFilter);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error("[orders] Supabase Hatası:", error);
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası: " + error.message });
    }

    console.log(`[orders] DB'den ${sales?.length || 0} satış çekildi.`);

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
        // Tarih filtresi (Sadece OrderCode yoksa tarih filtresi uygula)
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
        // "Perakende Satış - " prefix'ini kaldır (BirFatura'da gereksiz)
        let customerName = sale.customer_name || sale.customer || 'Misafir Müşteri';
        customerName = customerName.replace(/^Perakende Satış\s*[-–]\s*/i, '').trim() || 'Misafir Müşteri';

        let ssnTcNo = "";
        let taxNo = "";
        let rawTax = sale.tax_number || "";

        if (rawTax.length === 11) {
            ssnTcNo = rawTax;
        } else if (rawTax.length > 0) {
            taxNo = rawTax;
        }

        // Toptan Satış veya Misafir için varsayılan TC
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
            let vatRate = parseInt(item.vat_rate || item.kdv || 20, 10);
            // Eski api.js yanlışlıkla vat_rate=18 kaydetmişti. Gerçek KDV oranı %20.
            // %18 gelen değerleri %20'ye düzelt (Türkiye'de %18 KDV oranı yok).
            if (vatRate === 18) vatRate = 20;
            const unitPriceInclTax = parseFloat(item.final_price || item.price || 0);
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

            orderDetails.push({
                "ProductId": parseInt(item.id, 10) || 0,
                "ProductCode": item.stock_code || item.code || "URUN01",
                "Barcode": item.barcode || item.stock_code || "",
                "ProductBrand": item.brand || "",
                "ProductName": item.name || "Ürün",
                "ProductNote": item.note || "",
                "ProductQuantityType": item.unit || "Adet",
                "ProductQuantity": quantity,
                "VatRate": vatRate,
                "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                "DiscountUnitTaxExcluding": Number(discountUnitExclTax.toFixed(4)),
                "DiscountUnitTaxIncluding": Number(discountUnitInclTax.toFixed(4)),
                "Variants": []
            });
        });

        // İndirim toplamları
        const totalDiscountInclTax = orderDetails.reduce((sum, d) => sum + (d.DiscountUnitTaxIncluding * d.ProductQuantity), 0);
        const totalDiscountExclTax = orderDetails.reduce((sum, d) => sum + (d.DiscountUnitTaxExcluding * d.ProductQuantity), 0);

        // KDV oranı karışık olabilir, genel toplam hesaplama
        const calculatedTotalExclTax = orderDetails.reduce((sum, d) => sum + (d.ProductUnitPriceTaxExcluding * d.ProductQuantity), 0) - totalDiscountExclTax;

        const saleDateObj = new Date(sale.date || sale.created_at);
        const formattedDate = formatDateForBirFatura(saleDateObj);

        // *** KRİTİK: OrderId güvenli integer olmalı (MAX_SAFE_INTEGER aşmamalı) ***
        // sale.id veritabanından gelen güvenilir integer
        const orderId = sale.id || 0;

        // BirFatura Swagger Spec'ine TAM UYUMLU sipariş objesi
        // NOT: Spec'te olmayan alanlar (Status, OrderStatusId vb.) eklenmez
        ordersToSend.push({
            "OrderId": orderId,
            "OrderCode": sale.sale_code || `S-${orderId}`,
            "OrderDate": formattedDate,
            "CustomerId": 0,
            "BillingName": customerName,
            "BillingAddress": address,
            "BillingTown": district,
            "BillingCity": city,
            "BillingMobilePhone": phone,
            "BillingPhone": phone,
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
            "ShipCompany": "",
            "CargoCampaignCode": "",
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
            "OrderDetails": orderDetails
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
    // ...
    console.log("Frontend path not found:", frontendPath);
}

app.listen(PORT, () => {
    console.log(`PosCebimde Bridge Server running on port ${PORT}`);
});
