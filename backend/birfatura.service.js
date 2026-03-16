/**
 * BirFatura Integration Service
 * Handles mapping between local Supabase data and BirFatura API JSON structure.
 */

class BirFaturaService {
    /**
     * Parses BirFatura date format (DD.MM.YYYY HH:mm:ss)
     */
    parseDate(dateStr) {
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
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Formats Date to BirFatura format (DD.MM.YYYY HH:mm:ss)
     */
    formatDate(date) {
        if (!date) return null;
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Maps a Supabase sale and customer to BirFatura Order structure
     */
    mapSaleToOrder(sale, customer = null) {
        let customerName = customer?.name || sale.customer_name || sale.customer || 'Misafir Müşteri';
        
        // Clean customer name for BirFatura (strip "Perakende-" prefix if requested)
        if (customerName.startsWith('Perakende-')) {
            customerName = customerName.replace('Perakende-', '').trim();
        }

        let ssnTcNo = "";
        let taxNo = "";
        let taxOffice = customer?.tax_office || "";
        let rawTax = (customer?.tax_number || sale.tax_number || "").trim();

        if (rawTax.length === 11) {
            ssnTcNo = rawTax;
        } else if (rawTax.length > 0) {
            taxNo = rawTax;
        }

        // Default TC for Guest/Wholesale if none provided
        if (!ssnTcNo && !taxNo && (customerName === 'Misafir Müşteri' || customerName === 'Toptan Satış')) {
            ssnTcNo = '11111111111';
        }

        const billingAddress = customer?.address || sale.address || 'Fatih Mh.';
        const billingCity = customer?.city || 'Adana';
        const billingTown = customer?.district || 'Seyhan';
        const phone = customer?.phone || sale.phone || '';

        let items = sale.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }

        let totalGross = 0;
        let totalNet = 0;
        let totalDiscountGross = 0;
        let totalDiscountNet = 0;

        const orderDetails = (items || []).map(item => {
            const unitPriceInclTax = parseFloat(item.final_price || item.price || 0);
            const quantity = parseFloat(item.quantity || 1);
            const vatRate = parseFloat(item.vat_rate || 20);
            const discountRate = parseFloat(item.discount_rate || 0);

            const unitPriceExclTax = vatRate ? (unitPriceInclTax / (1 + vatRate / 100)) : unitPriceInclTax;

            const lineGross = unitPriceInclTax * quantity;
            const lineNet = unitPriceExclTax * quantity;
            const lineDiscountGross = lineGross * (discountRate / 100);
            const lineDiscountNet = lineNet * (discountRate / 100);

            totalGross += (lineGross - lineDiscountGross);
            totalNet += (lineNet - lineDiscountNet);
            totalDiscountGross += lineDiscountGross;
            totalDiscountNet += lineDiscountNet;

            const discountUnitGross = quantity > 0 ? (lineDiscountGross / quantity) : 0;
            const discountUnitNet = quantity > 0 ? (lineDiscountNet / quantity) : 0;

            return {
                "ProductId": item.id || 0,
                "ProductCode": item.stock_code || item.code || "URUN01",
                "Barcode": item.barcode || item.stock_code || "",
                "ProductBrand": item.brand || "",
                "ProductName": item.name || "Urun",
                "ProductNote": item.note || "",
                "ProductImage": item.image_url || item.image || "",
                "Variants": Array.isArray(item.variants) ? item.variants : [],
                "ProductQuantityType": item.unit || item.quantity_type || "Adet",
                "ProductQuantity": quantity,
                "VatRate": vatRate,
                "ProductUnitPriceTaxExcluding": Number(unitPriceExclTax.toFixed(4)),
                "ProductUnitPriceTaxIncluding": Number(unitPriceInclTax.toFixed(4)),
                "DiscountUnitTaxExcluding": Number(discountUnitNet.toFixed(4)),
                "DiscountUnitTaxIncluding": Number(discountUnitGross.toFixed(4))
            };
        });

        if (totalGross === 0 && sale.total) {
            totalGross = Number(sale.total) || 0;
            totalNet = totalGross / 1.20;
        }

        // OrderId should be numeric for BirFatura. Match old logic for consistency.
        let orderId = 0;
        try {
            const codeWithoutPrefix = (sale.sale_code || '').split('-')[1] || sale.sale_code;
            orderId = parseInt(codeWithoutPrefix.substring(0, 18)) || sale.id || 0;
        } catch (e) {
            orderId = sale.id || 0;
        }

        return {
            "OrderId": orderId,
            "OrderCode": sale.sale_code || `S-${orderId}`,
            "OrderDate": this.formatDate(sale.date || sale.created_at),
            "CustomerId": customer?.id || 0,
            "BillingName": customerName,
            "BillingAddress": billingAddress,
            "BillingTown": billingTown,
            "BillingCity": billingCity,
            "BillingMobilePhone": phone,
            "TaxOffice": taxOffice,
            "TaxNo": taxNo,
            "SSNTCNo": ssnTcNo,
            "Email": customer?.email || "",
            "ShippingId": 0,
            "ShippingName": customerName,
            "ShippingAddress": billingAddress,
            "ShippingTown": billingTown,
            "ShippingCity": billingCity,
            "ShippingCountry": "Türkiye",
            "ShippingZipCode": customer?.zip_code || "",
            "ShippingPhone": phone,
            "ShipCompany": "Kargo",
            "PaymentTypeId": this.mapPaymentMethodToId(sale.payment_method),
            "PaymentType": sale.payment_method || "Kredi Kartı",
            "Status": 1,
            "OrderStatusId": 1,
            "Currency": "TRY",
            "CurrencyRate": 1,
            "TotalPaidTaxIncluding": Number(totalGross.toFixed(2)),
            "TotalPaidTaxExcluding": Number(totalNet.toFixed(2)),
            "ProductsTotalTaxIncluding": Number(totalGross.toFixed(2)),
            "ProductsTotalTaxExcluding": Number(totalNet.toFixed(2)),
            "CommissionTotalTaxExcluding": 0,
            "CommissionTotalTaxIncluding": 0,
            "ShippingChargeTotalTaxExcluding": 0,
            "ShippingChargeTotalTaxIncluding": 0,
            "PayingAtTheDoorChargeTotalTaxExcluding": 0,
            "PayingAtTheDoorChargeTotalTaxIncluding": 0,
            "DiscountTotalTaxExcluding": Number(totalDiscountNet.toFixed(2)),
            "DiscountTotalTaxIncluding": Number(totalDiscountGross.toFixed(2)),
            "InstallmentChargeTotalTaxExcluding": 0,
            "InstallmentChargeTotalTaxIncluding": 0,
            "BankTransferDiscountTotalTaxExcluding": 0,
            "BankTransferDiscountTotalTaxIncluding": 0,
            "OrderDetails": orderDetails,
            "ExtraFees": []
        };
    }

    /**
     * Maps local payment method names to BirFatura IDs
     */
    mapPaymentMethodToId(method) {
        const m = (method || '').toLowerCase();
        if (m.includes('kredi') || m.includes('pos') || m.includes('kart')) return 1;
        if (m.includes('havale') || m.includes('eft')) return 2;
        if (m.includes('nakit')) return 3; // Kapıda Nakit or Nakit
        return 5; // Nakit / Diğer
    }

    /**
     * Returns standard BirFatura order statuses
     */
    getOrderStatuses() {
        return [
            { Id: 1, Value: "Onaylandı" },
            { Id: 2, Value: "Kargolandı" },
            { Id: 3, Value: "İptal Edildi" },
            { Id: 4, Value: "Tamamlandı" }
        ];
    }

    /**
     * Returns standard BirFatura payment methods
     */
    getPaymentMethods() {
        return [
            { Id: 1, Value: "Kredi Kartı" },
            { Id: 2, Value: "Banka EFT-Havale" },
            { Id: 3, Value: "Kapıda Ödeme Nakit" },
            { Id: 4, Value: "Kapıda Ödeme Kredi Kartı" },
            { Id: 5, Value: "Nakit" }
        ];
    }
}

module.exports = new BirFaturaService();
