import axios from 'axios';

// Backend proxy URL (must point to KasaPos Node.js backend)
// For dev it is typically same host on port 3001, or relative if served together.
const LOCAL_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const birFaturaAPI = {
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
