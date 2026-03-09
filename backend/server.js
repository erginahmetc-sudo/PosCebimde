const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;


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

        const response = await axios.post(url, payload, {
            headers,
            timeout: 30000
        });

        res.json(response.data);
    } catch (error) {
        console.error('[BirFatura Proxy] Error:', error.message);

        if (error.response) {
            // BirFatura API'den gelen hata
            res.status(error.response.status).json({
                Success: false,
                Message: error.response.data?.Message || error.message,
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

// --- ENDPOINT: BirFatura Order Statuses ---
app.post('/api/orderStatus/', async (req, res) => {
    const receivedToken = req.headers['token'];
    if (!receivedToken) {
        return res.status(401).json({ error: "Yetkisiz Erişim" });
    }
    // Return order statuses
    res.json({
        OrderStatus: [{ Id: 1, Value: "Onaylandı" }]
    });
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
// Flask'ta çalışan /api/orders/ endpoint'i ile aynı mantık
app.post('/api/orders/', async (req, res) => {
    // 1. Auth Check (API Şifresi) - BirFatura 'token' header'ı gönderir
    const receivedToken = req.headers['token'];
    console.log("BirFatura İsteği Geldi:", req.body);
    console.log("Alınan Token:", receivedToken);

    if (!receivedToken) {
        return res.status(401).json({ "Orders": [], "error": "Token eksik" });
    }

    if (!supabase) {
        console.error("Supabase not initialized.");
        return res.status(503).json({ "Orders": [], "error": "Veritabanı bağlantısı yok" });
    }

    // 2. Validate Token & Get Company Code
    // Token değerini doğrudan karşılaştır (JSON.stringify olmadan da dene)
    let setting = null;

    // Önce doğrudan string olarak dene
    const { data: setting1, error: error1 } = await supabase
        .from('app_settings')
        .select('company_code, value')
        .eq('key', 'secret_token')
        .single();

    if (setting1) {
        // value JSONB olduğu için içinden değeri çıkar
        let storedToken = setting1.value;
        // Eğer tırnak içinde geldiyse temizle
        if (typeof storedToken === 'string') {
            storedToken = storedToken.replace(/^"|"$/g, '');
        }

        console.log("DB'deki Token:", storedToken);
        console.log("Gelen Token:", receivedToken);

        if (storedToken === receivedToken) {
            setting = setting1;
        }
    }

    if (!setting || !setting.company_code) {
        console.warn("Invalid token received or no company found:", receivedToken);
        return res.status(401).json({ "Orders": [], "error": "Yetkisiz Erişim / Geçersiz Token" });
    }

    const companyCode = setting.company_code;
    console.log(`BirFatura request authorized for Company: ${companyCode}`);

    // 3. Fetch Sales for this Company
    const filterData = req.body;
    const startDateTimeStr = filterData.startDateTime; // DD.MM.YYYY HH:mm:ss
    const endDateTimeStr = filterData.endDateTime;
    const orderCodeFilter = filterData.OrderCode;

    let query = supabase
        .from('sales')
        .select('*')
        .eq('company_code', companyCode)
        .eq('is_deleted', false);

    if (orderCodeFilter) {
        query = query.eq('sale_code', orderCodeFilter);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası" });
    }

    console.log(`Toplam ${sales?.length || 0} satış bulundu.`);

    // 4. Process and Filter (Date logic etc.)
    const ordersToSend = [];

    let startDate = null, endDate = null;
    try {
        if (startDateTimeStr && endDateTimeStr) {
            startDate = parseDate(startDateTimeStr);
            endDate = parseDate(endDateTimeStr);
        }
    } catch (e) {
        console.error("Tarih parse hatası:", e);
        // Tarih hatası olsa bile devam et, tarih filtresi uygulama
    }

    for (const sale of (sales || [])) {
        // Date Filter
        let saleDate;
        try {
            saleDate = new Date(sale.date || sale.created_at);
        } catch (e) {
            continue;
        }

        if (startDate && endDate) {
            if (saleDate < startDate || saleDate > endDate) continue;
        }

        // --- Customer & Tax Logic (Flask'tan kopyalandı) ---
        const customerName = sale.customer_name || sale.customer || 'Misafir Müşteri';

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

        const shippingTaxNumber = taxNo ? taxNo : ssnTcNo;

        let address = "Belirtilmemiş";
        let city = "Adana";
        let district = "Seyhan";

        // --- Items Logic ---
        let calculatedTotal = 0;
        const orderDetails = [];

        let items = sale.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }

        if (Array.isArray(items)) {
            items.forEach(item => {
                // final_price varsa kullan, yoksa price (Flask'taki gibi)
                const unitPriceInclTax = parseFloat(item.final_price || item.price || 0);
                const quantity = parseFloat(item.quantity || 1);
                const unitPriceExclTax = unitPriceInclTax / 1.20;

                calculatedTotal += unitPriceInclTax * quantity;

                orderDetails.push({
                    "ProductId": 0,
                    "ProductCode": item.stock_code || "",
                    "Barcode": item.stock_code || "",
                    "ProductName": item.name || "",
                    "ProductQuantity": quantity,
                    "VatRate": 20.0,
                    "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                    "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                    "Variants": []
                });
            });
        }

        const calculatedTotalExclTax = calculatedTotal / 1.20;

        // Flask'taki formatla aynı: DD.MM.YYYY HH:MM:SS
        const formattedDate = formatDateForBirFatura(saleDate);

        // OrderId: Flask'taki gibi sale_code'dan sayısal değer çıkar
        let orderId = 0;
        try {
            // sale_code formatı: SERVER-20260118001234567890 veya S-1234567890
            const codeWithoutPrefix = sale.sale_code.split('-')[1] || sale.sale_code;
            orderId = parseInt(codeWithoutPrefix.substring(0, 18)) || sale.id || 0;
        } catch (e) {
            orderId = sale.id || 0;
        }

        ordersToSend.push({
            "OrderId": orderId,
            "OrderCode": sale.sale_code,
            "OrderDate": formattedDate,
            "CustomerId": 0,
            "BillingName": customerName,
            "BillingAddress": address,
            "BillingTown": district,
            "BillingCity": city,
            "BillingTaxOffice": "",
            "TaxNo": taxNo,
            "SSNTCNo": ssnTcNo,
            "ShippingId": 0,
            "ShippingName": customerName,
            "ShippingAddress": address,
            "ShippingTown": district,
            "ShippingCity": city,
            "ShippingTaxNumber": shippingTaxNumber,
            "ShipCompany": "Kargo",
            "PaymentTypeId": 1,
            "PaymentType": "Kredi Kartı",
            "Currency": "TRY",
            "CurrencyRate": 1,
            "TotalPaidTaxIncluding": Number(calculatedTotal.toFixed(2)),
            "TotalPaidTaxExcluding": Number(calculatedTotalExclTax.toFixed(2)),
            "OrderDetails": orderDetails
        });
    }

    console.log(`BirFatura'ya ${ordersToSend.length} sipariş gönderiliyor.`);
    res.json({ "Orders": ordersToSend });
});

// Trailing slash olmadan da çalışsın
app.post('/api/orders', async (req, res) => {
    // Aynı handler'ı çağır
    req.url = '/api/orders/';
    app._router.handle(req, res, () => { });
});

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
    console.log(`BirFatura Bridge Server running on port ${PORT}`);
});
