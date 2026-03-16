const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const birFaturaService = require('./birfatura.service');

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
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey && SUPABASE_URL) {
        adminSupabase = createClient(SUPABASE_URL, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log("Admin Supabase client initialized (using Service Role Key).");
    } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY not found in .env. Admin operations will use standard client.");
        // Fallback to normal client if no service key
        adminSupabase = supabase;
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

// --- HELPER: Date Parsing (BirFatura format: DD.MM.YYYY HH:mm:ss veya DD.MM.YYYY) ---
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(' ');
    const dateParts = (parts[0] || '').split('.');
    if (dateParts.length < 3) return null;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    let hour = 0, minute = 0, second = 0;
    if (parts[1]) {
        const timeParts = parts[1].split(':');
        hour = parseInt(timeParts[0], 10) || 0;
        minute = parseInt(timeParts[1], 10) || 0;
        second = parseInt(timeParts[2], 10) || 0;
    }
    const d = new Date(year, month, day, hour, minute, second);
    if (isNaN(d.getTime())) return null;
    return d;
}

/**
 * Validates the BirFatura token against DB settings or fallback
 * Returns { isValid: boolean, companyCode: string|null }
 */
async function checkBirFaturaToken(receivedToken, client) {
    if (!receivedToken) return { isValid: false, companyCode: null };

    // 1. Fallback token check (emergency access)
    if (receivedToken === 'kasapos-2026-secret-api-token') {
        console.log("[Auth] Fallback token accepted.");
        return { isValid: true, companyCode: null };
    }

    // 2. Query Supabase for settings with this token
    const { data: settings, error } = await client
        .from('app_settings')
        .select('company_code, value')
        .eq('key', 'secret_token');

    if (error) {
        console.error("[Auth] Token query error:", error);
        return { isValid: false, companyCode: null };
    }

    if (settings && settings.length > 0) {
        for (const setting of settings) {
            if (setting.value) {
                let storedToken = setting.value;
                if (typeof storedToken === 'string') {
                    storedToken = storedToken.replace(/^"|"$/g, '').trim();
                }
                if (storedToken === (receivedToken || '').trim()) {
                    return { isValid: true, companyCode: setting.company_code };
                }
            }
        }
    }

    return { isValid: false, companyCode: null };
}

// --- HELPER: Format Date to BirFatura format ---
// Note: formatDateForBirFatura is now handled by birFaturaService.formatDate

// --- ENDPOINT: BirFatura Order Statuses ---
app.post('/api/orderStatus/', async (req, res) => {
    const receivedToken = req.headers['token'];
    const client = adminSupabase || supabase;
    const auth = await checkBirFaturaToken(receivedToken, client);

    if (!auth.isValid) {
        return res.status(401).json({ error: "Yetkisiz Erişim / Geçersiz Token" });
    }

    res.json({
        OrderStatus: birFaturaService.getOrderStatuses()
    });
});

// --- ENDPOINT: BirFatura Payment Methods ---
app.post('/api/paymentMethods/', async (req, res) => {
    const receivedToken = req.headers['token'];
    const client = adminSupabase || supabase;
    const auth = await checkBirFaturaToken(receivedToken, client);

    if (!auth.isValid) {
        return res.status(401).json({ error: "Yetkisiz Erişim / Geçersiz Token" });
    }

    res.json({
        PaymentMethods: birFaturaService.getPaymentMethods()
    });
});

// --- ENDPOINT: BirFatura Cargo Update ---
app.post('/api/orderCargoUpdate/', async (req, res) => {
    // Acknowledge cargo update (stub method)
    res.status(200).send();
});

// --- ENDPOINT: BirFatura Invoice Link Update ---
app.post('/api/invoiceLinkUpdate/', async (req, res) => {
    // Acknowledge invoice link generation (stub method)
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

// --- ENDPOINT: BirFatura Polls This for Orders (r4 ile aynı mantık) ---
app.post('/api/orders/', async (req, res) => {
    const receivedToken = req.headers['token'] || req.headers['authorization'] || req.query.token;
    console.log(`[DEBUG] /api/orders/ Request:
      Headers: ${JSON.stringify(req.headers)}
      Body: ${JSON.stringify(req.body)}
      Token found: ${receivedToken}
    `);

    if (!receivedToken) {
        return res.status(401).json({ "Orders": [], "error": "Token eksik" });
    }

    if (!supabase) {
        console.error("Supabase not initialized.");
        return res.status(503).json({ "Orders": [], "error": "Veritabanı bağlantısı yok" });
    }

    const client = adminSupabase || supabase;
    const auth = await checkBirFaturaToken(receivedToken, client);

    if (!auth.isValid) {
        console.warn("Invalid token received:", receivedToken);
        return res.status(401).json({ "Orders": [], "error": "Yetkisiz Erişim / Geçersiz Token" });
    }

    const companyCode = auth.companyCode;

    // 3. Fetch Sales (service role = RLS bypass, BirFatura sunucusu kullanıcı oturumu olmadan çağırıyor)
    let query = client
        .from('sales')
        .select('*')
        .eq('is_deleted', false);

    if (companyCode) {
        query = query.eq('company_code', companyCode);
    }

    const filterData = req.body || {};
    const startDateTimeStr = filterData.startDateTime;
    const endDateTimeStr = filterData.endDateTime;
    const orderCodeFilter = filterData.OrderCode;

    if (orderCodeFilter) {
        query = query.eq('sale_code', orderCodeFilter);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error("Supabase Error:", error);
        return res.status(500).json({ "Orders": [], "error": "Veritabanı Hatası" });
    }

    console.log(`Toplam ${sales?.length || 0} faturası kesilecek satış bulundu.`);

    // 4. Optimization: Collect all customer IDs and fetch them in one query
    const customerIds = [...new Set((sales || []).map(s => s.customer_id).filter(id => id))];
    const customerMap = {};
    if (customerIds.length > 0) {
        const { data: customers } = await client
            .from('customers')
            .select('*')
            .in('id', customerIds);
        
        if (customers) {
            customers.forEach(c => { customerMap[c.id] = c; });
        }
    }

    // 5. Process and Filter
    const ordersToSend = [];
    const filterStartDate = (startDateTimeStr && endDateTimeStr) ? parseDate(startDateTimeStr) : null;
    const filterEndDate = (startDateTimeStr && endDateTimeStr) ? parseDate(endDateTimeStr) : null;

    if (filterStartDate) console.log("Tarih Filtresi Uygulanıyor:", filterStartDate, "-", filterEndDate);

    for (const sale of (sales || [])) {
        if (!orderCodeFilter && filterStartDate && filterEndDate) {
            try {
                const saleDate = new Date(sale.date || sale.created_at);
                if (saleDate < filterStartDate || saleDate > filterEndDate) continue;
            } catch (e) { continue; }
        }

        const customer = customerMap[sale.customer_id] || null;
        ordersToSend.push(birFaturaService.mapSaleToOrder(sale, customer));
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

// --- Eksik şirket kodlu satışları düzelt (SQL çalıştırmadan, tek tık) ---
app.post('/api/admin/fix-sales-company-code', async (req, res) => {
    const { company_code } = req.body || {};
    if (!company_code || typeof company_code !== 'string') {
        return res.status(400).json({ success: false, message: 'company_code gerekli.' });
    }
    const client = adminSupabase || supabase;
    if (!client) {
        return res.status(503).json({ success: false, message: 'Veritabanı bağlantısı yok.' });
    }
    const { data, error } = await client
        .from('sales')
        .update({ company_code: company_code.trim() })
        .is('company_code', null)
        .eq('is_deleted', false)
        .select('sale_code');
    if (error) {
        console.error('[fix-sales-company-code]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
    const updated = (data && data.length) ? data.length : 0;
    console.log(`[fix-sales-company-code] ${updated} satış güncellendi.`);
    return res.json({ success: true, updated });
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
