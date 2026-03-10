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

        // TC / VKN ayrıştırma
        const cleanTaxNumber = String(retailForm.tax_number || "").trim();
        const taxNo = (cleanTaxNumber.length > 0 && cleanTaxNumber.length !== 11) ? cleanTaxNumber : "";

        // Toplam hesapla
        const total = cart.reduce((sum, item) => {
            const price = item.price * item.quantity;
            const discount = price * (item.discount_rate || 0) / 100;
            return sum + (price - discount);
        }, 0);
        const totalExclTax = total / 1.20;

        const today = new Date().toISOString().split('T')[0];

        // Ürün satırları
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
                DiscountIsPercentUnit: discountRate > 0 ? 1 : 0,
                DiscountRateUnit: discountRate,
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
                OrderCode: saleCode || ('SLS-' + Date.now()),
                OrderDate: today,
                InvoiceDate: today,
                InvoiceExplanation: "POS Satış",
                EInvoiceId: "",
                IsDocumentNoAuto: true,
                ETTN: ettn,
                ReceiverTag: null,
                BillingName: retailForm.name || "Perakende Müşteri",
                BillingAddress: retailForm.address || "",
                BillingTown: retailForm.district || "",
                BillingCity: retailForm.city || "",
                BillingMobilePhone: retailForm.phone || "",
                BillingPhone: retailForm.phone || "",
                BillingPhone2: null,
                TaxOffice: retailForm.tax_office || "",
                TaxNo: taxNo,
                Email: retailForm.email || "",
                ShipCompany: "",
                CargoCampaignCode: "",
                ShippingName: retailForm.name || "",
                ShippingAddress: retailForm.address || "",
                ShippingTown: retailForm.district || "",
                ShippingCity: retailForm.city || "",
                ShippingCountry: "Türkiye",
                ShippingZipCode: "",
                ShippingPhone: retailForm.phone || "",
                DeliveryFeeType: 3,
                PaymentType: paymentMethod || "Nakit",
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
            console.log(`[BirFaturaService] Direkt fatura gönderiliyor: ${invoicePayload.Invoice.OrderCode}`);
            const response = await axios.post(`${LOCAL_BACKEND_URL}/api/birfatura-proxy`, {
                endpoint: "OutEBelgeV2/SendBasicInvoiceFromModel",
                apiKey: config.api_key,
                secretKey: config.secret_key,
                integrationKey: config.integration_key,
                payload: invoicePayload
            }, { headers: { 'Content-Type': 'application/json' } });

            const responseData = response.data;
            if (responseData && (responseData.Success || responseData.success)) {
                return { success: true, data: responseData };
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
            endpoint: "OutEBelge/CreateEBelgeFromTemplateAndSend",
            apiKey: config.api_key,
            secretKey: config.secret_key,
            integrationKey: config.integration_key,
            payload: {
                SystemType: "EFATURA",
                OrderCode: sale.sale_code,
                TemplateType: "STANDART"
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
            
            if (responseData && responseData.Success) {
                // Success! Get the UUID and InvoiceNo if available
                const resultData = responseData.Result || {};
                const uuid = resultData.UUID;
                
                if (!uuid) {
                     console.warn(`[BirFaturaService] Success true, but no UUID received:`, responseData);
                     // Still consider it a success if the API said so, but UUID is missing.
                }

                return { 
                    success: true, 
                    message: "Sipariş verisi aktarıldı, fatura oluşturuluyor.",
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
