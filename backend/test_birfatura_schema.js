const axios = require('axios');

async function testBirFaturaAPI() {
    try {
        console.log("Testing /api/paymentMethods/ ...");
        const pmRes = await axios.post('http://localhost:5000/api/paymentMethods/', {}, {
            headers: { 'token': 'kasapos-2026-secret-api-token' }
        });
        console.log("Payment Methods OK. Length:", pmRes.data.PaymentMethods?.length);

        console.log("Testing /api/orders/ ...");
        const orderRes = await axios.post('http://localhost:5000/api/orders/', {
            "orderStatusId": 1,
            "startDateTime": "01.01.2024 00:00:00",
            "endDateTime": "31.12.2026 23:59:59"
        }, {
            headers: { 'token': 'kasapos-2026-secret-api-token' }
        });

        const orders = orderRes.data.Orders;
        console.log(`Orders fetched: ${orders?.length || 0}`);

        if (orders && orders.length > 0) {
            const firstOrder = orders[0];
            console.log("\nSample Order Format Check:");
            const requiredFields = [
                'OrderId', 'OrderCode', 'OrderDate', 'BillingName', 'BillingAddress',
                'BillingTown', 'BillingCity', 'BillingMobilePhone', 'ShippingName',
                'ShippingAddress', 'ShippingTown', 'ShippingCity', 'PaymentTypeId',
                'Currency', 'TotalPaidTaxExcluding', 'TotalPaidTaxIncluding',
                'ProductsTotalTaxExcluding', 'ProductsTotalTaxIncluding', 'OrderDetails'
            ];

            let allPresent = true;
            for (const field of requiredFields) {
                if (firstOrder[field] === undefined) {
                    console.error(`MISSING FIELD: ${field}`);
                    allPresent = false;
                }
            }
            if (allPresent) console.log("All main required fields are present.");

            if (firstOrder.OrderDetails && firstOrder.OrderDetails.length > 0) {
                const requiredItemFields = [
                    'ProductId', 'ProductCode', 'ProductName', 'ProductQuantityType',
                    'ProductQuantity', 'VatRate', 'ProductUnitPriceTaxExcluding', 'ProductUnitPriceTaxIncluding'
                ];
                let allItemPresent = true;
                for (const field of requiredItemFields) {
                    if (firstOrder.OrderDetails[0][field] === undefined) {
                        console.error(`MISSING ITEM FIELD: ${field}`);
                        allItemPresent = false;
                    }
                }
                if (allItemPresent) console.log("All required detail fields are present.");
            }
        }

    } catch (err) {
        console.error("Test failed:", err.message);
        if (err.response) {
            console.error(err.response.data);
        }
    }
}

testBirFaturaAPI();
