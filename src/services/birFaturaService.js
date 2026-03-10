import axios from 'axios';

// Base URL derived from the Python code
const API_BASE_URL = "https://uygulama.edonustur.com/api";

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

        if (!config.api_key || !config.secret_key) {
            return { success: false, message: "API veya Secret Key eksik. Lütfen Ayarlar sayfasını kontrol edin." };
        }

        // TC / VKN ayrıştırma
        const cleanTaxNumber = String(retailForm.tax_number || "").trim();
        const taxNo = (cleanTaxNumber.length > 0 && cleanTaxNumber.length !== 11) ? cleanTaxNumber : "";
        const ssnTcNo = cleanTaxNumber.length === 11 ? cleanTaxNumber : "";

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

        const payload = {
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
            const response = await axios.post(`${API_BASE_URL}/OutEBelgeV2/SendBasicInvoiceFromModel`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': config.api_key,
                    'X-Secret-Key': config.secret_key,
                    'X-Integration-Key': config.integration_key
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error("BirFatura SendBasicInvoice Error:", error);
            const errorMsg = error.response?.data?.message || error.response?.data?.Message || error.message || "Bilinmeyen Hata";
            return { success: false, message: `BirFatura Hatası: ${errorMsg}` };
        }
    },

    /**
     * Create/Send an order to BirFatura
     * Uses the data structure extracted from the user's Python code (get_orders function).
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

        if (!config.api_key || !config.secret_key) {
            return {
                success: false,
                message: "API veya Secret Key eksik. Lütfen Ayarlar sayfasını kontrol edin."
            };
        }

        // 2. Prepare Data (Replicating Python 'get_orders' logic)

        // --- Customer & Tax Logic ---
        const customerName = sale.customer_name || (sale.customer?.name) || (typeof sale.customer === 'string' ? sale.customer : 'Misafir Müşteri');

        // Note: In the React app, we might need to fetch the detailed customer object if it's not fully in 'sale'.
        // For now, checks 'sale.customer' object or falls back to defaults as per Python code.
        let taxNumber = "";
        let taxOffice = "";
        let address = "";
        let city = "Adana"; // Default from Python code
        let district = "Seyhan"; // Default from Python code

        if (sale.customer && typeof sale.customer === 'object') {
            taxNumber = sale.customer.tax_number || "";
            taxOffice = sale.customer.tax_office || "";
            address = sale.customer.address || "";
            city = sale.customer.city || city;
            district = sale.customer.district || district;
        } else if (sale.customer_name === 'Misafir Müşteri' || sale.customer === 'Toptan Satış') {
            // Defaults handled below
        }

        // Tax/TC Identity Logic (Python Ref: Lines 762-772)
        let taxNo = "";
        let ssnTcNo = "";
        const cleanTaxNumber = String(taxNumber || "").trim();

        if (cleanTaxNumber.length === 11) {
            ssnTcNo = cleanTaxNumber;
        } else if (cleanTaxNumber.length > 0) {
            taxNo = cleanTaxNumber;
        }

        // Fallback for Toptan/Misafir (Python Ref: Lines 776-778)
        if ((!ssnTcNo && !taxNo) && (customerName === 'Misafir Müşteri' || customerName === 'Toptan Satış')) {
            ssnTcNo = "11111111111"; // Default generic TC
        }

        const shippingTaxNumber = taxNo ? taxNo : ssnTcNo;

        // --- Order Details Calculation (Python Ref: Lines 786-805) ---
        let calculatedTotal = 0;
        let calculatedTotalExclTax = 0;

        const orderDetails = sale.items.map(item => {
            // Python code assumes item.price is tax INCLUSIVE
            const unitPriceInclTax = parseFloat(item.price || 0);
            const unitPriceExclTax = unitPriceInclTax / 1.20; // Assuming 20% VAT as per Python code
            const quantity = parseFloat(item.quantity || 1);

            calculatedTotal += unitPriceInclTax * quantity;

            return {
                "ProductId": 0,
                "ProductCode": item.stock_code || "",
                "Barcode": item.stock_code || "",
                "ProductName": item.name || "",
                "ProductQuantity": quantity,
                "VatRate": 20.0,
                "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                "Variants": []
            };
        });

        calculatedTotalExclTax = calculatedTotal / 1.20;

        // --- Final formatted Payload (Python Ref: Lines 807-833) ---
        // Note: The Python code returns {"Orders": [...]}. Here we probably send one order.
        // The endpoint structure depends on the "Push" API which wasn't in the Python code (only Pull).
        // Assuming a standard POST structure based on the provided JSON fields.

        const saleDate = new Date();
        const formattedDate = saleDate.toLocaleDateString('tr-TR') + ' ' + saleDate.toLocaleTimeString('tr-TR');

        const formattedOrder = {
            "OrderCode": sale.sale_code,
            "OrderDate": formattedDate,
            "CustomerId": 0,
            "BillingName": customerName,
            "BillingAddress": address,
            "BillingTown": district,
            "BillingCity": city,
            "BillingTaxOffice": taxOffice,
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
            "PaymentType": "Kredi Kartı", // Could be mapped from sale.payment_method
            "Currency": "TRY",
            "CurrencyRate": 1,
            "TotalPaidTaxIncluding": Number(calculatedTotal.toFixed(2)),
            "TotalPaidTaxExcluding": Number(calculatedTotalExclTax.toFixed(2)),
            "OrderDetails": orderDetails
        };

        // 3. Send Request
        // IMPORTANT: The endpoint below '/api/Orders' is a guess based on standard REST practices 
        // and the domain from the user's code. 
        // The user's Python code was a PROVIDER (Pull), so it didn't have the PUSH URL.
        try {
            const response = await axios.post(`${API_BASE_URL}/Orders`, formattedOrder, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': config.api_key,
                    'X-Secret-Key': config.secret_key,
                    'X-Integration-Key': config.integration_key
                }
            });

            return { success: true, data: response.data };
        } catch (error) {
            console.error("BirFatura API Error:", error);
            const errorMsg = error.response?.data?.message || error.message || "Bilinmeyen Hata";
            return {
                success: false,
                message: `BirFatura Hatası: ${errorMsg}`
            };
        }
    }
};
