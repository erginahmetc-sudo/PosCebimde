import axios from 'axios';

// Backend proxy URL (must point to KasaPos Node.js backend)
// For dev it is typically same host on port 3001, or relative if served together.
const LOCAL_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

export const birFaturaAPI = {

    /**
     * Direkt fatura kes: SendBasicInvoiceFromModel endpoint'ini kullanır.
     * @param {Object} params - { retailForm, cart, paymentMethod, saleCode }
     */
    sendBasicInvoice: async ({ retailForm, cart, paymentMethod, saleCode }) => {
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            return { success: false, message: "Ayarlar bulunamadı. Lütfen Ayarlar sayfasından BirFatura API anahtarlarını kaydedin." };
        }
        let config;
        try { config = JSON.parse(configStr); }
        catch (e) { return { success: false, message: "Ayar dosyası bozuk. Lütfen ayarları tekrar kaydedin." }; }

        if (!config.api_key || !config.secret_key || !config.integration_key) {
            return { success: false, message: "API, Secret veya Integration Key eksik. Lütfen Ayarlar sayfasını kontrol edin." };
        }

        // TC / VKN - SendBasicInvoiceFromModel sadece TaxNo alanını tanıyor
        const cleanTaxNumber = String(retailForm.tax_number || "").trim();
        const taxNo = cleanTaxNumber.length > 0 ? cleanTaxNumber : "11111111111";

        // Toplam hesapla
        const total = cart.reduce((sum, item) => {
            const price = item.price * item.quantity;
            const discount = price * (item.discount_rate || 0) / 100;
            return sum + (price - discount);
        }, 0);
        const totalExclTax = total / 1.20;

        const now = new Date();
        const today = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

        // Ürün satırları (PascalCase - BirFatura API formatı)
        const orderDetails = cart.map(item => {
            const priceIncl = parseFloat(item.price || 0);
            const priceExcl = priceIncl / 1.20;
            const qty = parseFloat(item.quantity || 1);
            const discountRate = item.discount_rate || 0;
            const discountIncl = priceIncl * qty * discountRate / 100;
            const discountExcl = discountIncl / 1.20;
            return {
                ProductCode: item.stock_code || "",
                Barcode: item.barcode || item.stock_code || "",
                ProductBrand: "",
                ProductName: item.name || "",
                ProductNote: "",
                ProductQuantityType: "Adet",
                ProductQuantity: qty,
                VatRate: 20,
                ProductUnitPriceTaxExcluding: Number(priceExcl.toFixed(4)),
                ProductUnitPriceTaxIncluding: Number(priceIncl.toFixed(4)),
                DiscountUnitTaxExcluding: Number(discountExcl.toFixed(2)),
                DiscountUnitTaxIncluding: Number(discountIncl.toFixed(2)),
            };
        });

        // UUID (ETTN) üret
        const ettn = (crypto.randomUUID ? crypto.randomUUID() :
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            }));

        const invoicePayload = {
            Invoice: {
                OrderCode: "",
                OrderDate: today,
                InvoiceDate: today,
                InvoiceExplanation: "",
                EInvoiceId: "",
                IsDocumentNoAuto: true,
                ETTN: ettn,
                ReceiverTag: "",
                BillingName: retailForm.name || "Perakende Müşteri",
                BillingAddress: retailForm.address || ".",
                BillingTown: retailForm.district || ".",
                BillingCity: retailForm.city || ".",
                BillingMobilePhone: retailForm.phone || "",
                BillingPhone: retailForm.phone || "",
                BillingPhone2: "",
                TaxOffice: retailForm.tax_office || "",
                TaxNo: taxNo,
                Email: retailForm.email || "",
                ShipCompany: "",
                CargoCampaignCode: "",
                ShippingName: retailForm.name || "Perakende Müşteri",
                ShippingAddress: retailForm.address || ".",
                ShippingTown: retailForm.district || ".",
                ShippingCity: retailForm.city || ".",
                ShippingCountry: "Türkiye",
                ShippingZipCode: "",
                ShippingPhone: retailForm.phone || "",
                DeliveryFeeType: 3,
                PaymentType: paymentMethod || "",
                Currency: "TRY",
                CurrencyRate: 1.0,
                TotalPaidTaxExcluding: Number(totalExclTax.toFixed(2)),
                TotalPaidTaxIncluding: Number(total.toFixed(2)),
                ProductsTotalTaxExcluding: Number(totalExclTax.toFixed(2)),
                ProductsTotalTaxIncluding: Number(total.toFixed(2)),
                ShippingChargeTotalTaxExcluding: 0.00,
                ShippingChargeTotalTaxIncluding: 0.00,
                InstallmentChargeTotalTaxExcluding: 0.00,
                InstallmentChargeTotalTaxIncluding: 0.00,
                BankTransferDiscountTotalTaxExcluding: 0.00,
                BankTransferDiscountTotalTaxIncluding: 0.00,
                PayingAtTheDoorChargeTotalTaxExcluding: 0.00,
                PayingAtTheDoorChargeTotalTaxIncluding: 0.00,
                DiscountTotalTaxExcluding: 0.00,
                DiscountTotalTaxIncluding: 0.00,
                OrderDetails: orderDetails
            }
        };

        try {
            console.log(`[BirFaturaService] Direkt fatura gönderiliyor...`);
            const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, {
                endpoint: "OutEBelgeV2/SendBasicInvoiceFromModel",
                apiKey: config.api_key,
                secretKey: config.secret_key,
                integrationKey: config.integration_key,
                payload: invoicePayload
            }, { headers: { 'Content-Type': 'application/json' } });

            const responseData = response.data;
            if (responseData && (responseData.Success || responseData.success)) {
                return { success: true, data: responseData, ettn };
            } else {
                return { success: false, message: `BirFatura Hatası: ${responseData?.Message || responseData?.message || "Bilinmeyen API hatası."}` };
            }
        } catch (error) {
            console.error("[BirFaturaService] SendBasicInvoice Hatası:", error);
            const errorMsg = error.response?.data?.Message || error.response?.data?.message || error.message || "Ağ Hatası";
            return { success: false, message: `Fatura Hatası: ${errorMsg}` };
        }
    },

    /**
     * Vergi numarası ile e-fatura mükellefini sorgula (GetUserPK endpoint).
     * 10 haneli VKN veya 11 haneli TCKN ile kullanılır.
     * @param {string} taxNumber - VKN veya TCKN
     * @returns {Object} { success, data: { title, identifier, name } } veya { success: false, message }
     */
    queryTaxPayer: async (taxNumber) => {
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            return { success: false, message: "BirFatura ayarları bulunamadı." };
        }
        let config;
        try { config = JSON.parse(configStr); }
        catch (e) { return { success: false, message: "Ayar dosyası bozuk." }; }

        if (!config.api_key || !config.secret_key || !config.integration_key) {
            return { success: false, message: "API anahtarları eksik." };
        }

        const cleanTaxNo = String(taxNumber || "").trim();
        if (cleanTaxNo.length < 10) {
            return { success: false, message: "Geçersiz vergi numarası." };
        }

        try {
            console.log(`[BirFaturaService] Mükellef sorgulanıyor: ${cleanTaxNo}`);
            const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, {
                endpoint: "OutEBelgeV2/GetUserPK",
                apiKey: config.api_key,
                secretKey: config.secret_key,
                integrationKey: config.integration_key,
                payload: { kn: cleanTaxNo }
            }, { headers: { 'Content-Type': 'application/json' } });

            const responseData = response.data;
            if (responseData && (responseData.Success || responseData.success)) {
                const results = responseData.Result || responseData.result || [];
                if (results.length > 0) {
                    return { success: true, data: results[0], isEFatura: true };
                } else {
                    return { success: true, data: null, isEFatura: false, message: "Bu numara e-fatura mükellefi değil." };
                }
            } else {
                return { success: false, message: responseData?.Message || responseData?.message || "Sorgulama başarısız." };
            }
        } catch (error) {
            console.error("[BirFaturaService] Mükellef Sorgulama Hatası:", error);
            const errorMsg = error.response?.data?.Message || error.response?.data?.message || error.message || "Ağ Hatası";
            return { success: false, message: `Sorgulama Hatası: ${errorMsg}` };
        }
    },

    /**
     * UUID ile fatura PDF linkini getir (GetPDFLinkByUUID endpoint).
     * @param {string} uuid - Fatura UUID (ETTN)
     * @returns {Object} { success, pdfUrl }
     */
    getPdfLink: async (uuid) => {
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) return { success: false, message: "Ayarlar bulunamadı." };
        let config;
        try { config = JSON.parse(configStr); }
        catch (e) { return { success: false, message: "Ayar dosyası bozuk." }; }

        if (!config.api_key || !config.secret_key || !config.integration_key) {
            return { success: false, message: "API anahtarları eksik." };
        }

        const extractPdfUrl = (responseData) => {
            // Response bir array olarak dönebilir: [{ uuid, pdfLink, success, message }]
            if (Array.isArray(responseData) && responseData.length > 0) {
                const item = responseData[0];
                if (item.pdfLink) return item.pdfLink;
                if (item.PdfLink) return item.PdfLink;
            }
            // Result alanında array olarak dönebilir
            if (responseData && (responseData.Success || responseData.success)) {
                const results = responseData.Result || responseData.result;
                if (Array.isArray(results) && results.length > 0) {
                    if (results[0].pdfLink) return results[0].pdfLink;
                    if (results[0].PdfLink) return results[0].PdfLink;
                }
                if (typeof results === 'string' && results.length > 0) return results;
            }
            return null;
        };

        // Önce EARSIV, sonra EFATURA dene
        for (const systemType of ["EARSIV", "EFATURA"]) {
            try {
                console.log(`[BirFaturaService] PDF link sorgulanıyor (${systemType}), UUID:`, uuid);
                const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, {
                    endpoint: "OutEBelgeV2/GetPDFLinkByUUID",
                    apiKey: config.api_key,
                    secretKey: config.secret_key,
                    integrationKey: config.integration_key,
                    payload: { uuids: [uuid], systemType }
                }, { headers: { 'Content-Type': 'application/json' } });

                console.log(`[BirFaturaService] PDF link response (${systemType}):`, JSON.stringify(response.data, null, 2));

                const pdfUrl = extractPdfUrl(response.data);
                if (pdfUrl) {
                    return { success: true, pdfUrl };
                }
            } catch (error) {
                console.warn(`[BirFaturaService] PDF Link (${systemType}) hatası:`, error.message);
            }
        }

        return { success: false, message: "PDF linki alınamadı." };
    },

    /**
     * Tüm vergi dairesi bilgilerini getir (GetTaxOfficesAndCodes endpoint).
     * @returns {Object} { success, data: [{ TaxOfficeName, TaxOfficeCode }] }
     */
    getTaxOffices: async () => {
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            return { success: false, message: "BirFatura ayarları bulunamadı." };
        }
        let config;
        try { config = JSON.parse(configStr); }
        catch (e) { return { success: false, message: "Ayar dosyası bozuk." }; }

        if (!config.api_key || !config.secret_key || !config.integration_key) {
            return { success: false, message: "API anahtarları eksik." };
        }

        try {
            const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, {
                endpoint: "OutEBelgeV2/GetTaxOfficesAndCodes",
                apiKey: config.api_key,
                secretKey: config.secret_key,
                integrationKey: config.integration_key,
                payload: {}
            }, { headers: { 'Content-Type': 'application/json' } });

            const responseData = response.data;
            if (responseData && (responseData.Success || responseData.success)) {
                const results = responseData.Result || responseData.result || [];
                return { success: true, data: results };
            } else {
                return { success: false, message: responseData?.Message || "Vergi daireleri alınamadı." };
            }
        } catch (error) {
            console.error("[BirFaturaService] Vergi Dairesi Hatası:", error);
            return { success: false, message: error.message || "Ağ Hatası" };
        }
    },

    /**
     * Trigger BirFatura to pull the order and create an invoice.
     * Uses 'OutEBelge/CreateEBelgeFromTemplateAndSend' endpoint via backend proxy.
     * @param {Object} sale - The sale object from KasaPos
     */
    createOrder: async (sale) => {
        // 1. Load Configuration
        const configStr = localStorage.getItem('birfatura_config');
        if (!configStr) {
            return {
                success: false,
                message: "Ayarlar bulunamadı. Lütfen Ayarlar sayfasından BirFatura API anahtarlarını kaydedin."
            };
        }

        let config;
        try {
            config = JSON.parse(configStr);
        } catch (e) {
            return { success: false, message: "Ayar dosyası bozuk. Lütfen ayarları tekrar kaydedin." };
        }

        if (!config.api_key || !config.secret_key || !config.integration_key) {
            return {
                success: false,
                message: "API, Secret veya Integration Key eksik. Lütfen Ayarlar sayfasını kontrol edin."
            };
        }

        if (!sale || !sale.sale_code) {
             return { success: false, message: "Geçersiz satış verisi. Fatura gönderilemez." };
        }

        // 2. Prepare Proxy Payload
        // Just trigger the creation, the real pulling happens when BirFatura servers 
        // call our backend /api/orders endpoint.
        const proxyPayload = {
            endpoint: "Order/InsertOrder",
            apiKey: config.api_key,
            secretKey: config.secret_key,
            integrationKey: config.integration_key,
            payload: {
                OrderCode: sale.sale_code
            }
        };

        // 3. Send Request
        try {
            console.log(`[BirFaturaService] BirFatura tetikleniyor: ${sale.sale_code}`);
            
            const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, proxyPayload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const responseData = response.data;
            
            if (responseData && (responseData.Success || responseData.success)) {
                return { 
                    success: true, 
                    message: "Sipariş verisi aktarıldı, BirFatura portalında 'Onaylanmış Siparişler' kısmına düşecektir.",
                    data: responseData 
                };
            } else {
                return {
                    success: false,
                    message: `BirFatura Hatası: ${responseData?.Message || "Bilinmeyen API hatası."}`
                };
            }
        } catch (error) {
            console.error("[BirFaturaService] İstek Hatası:", error);
            const errorMsg = error.response?.data?.Message || error.message || "Ağ Hatası";
            return {
                success: false,
                message: `Bağlantı Hatası: ${errorMsg}`
            };
        }
    }
};
