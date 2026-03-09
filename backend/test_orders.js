const axios = require('axios');

async function testOrders() {
    try {
        const response = await axios.post('http://localhost:3001/api/orders/', {
            "startDateTime": "15.01.2023 00:00:00",
            "endDateTime": "15.01.2026 23:59:59"
        }, {
            headers: {
                'token': 'kasapos-2026-secret-api-token'
            }
        });
        console.log("Success:", response.status);
        console.log("Data length:", response.data.Orders ? response.data.Orders.length : 0);
        console.log("First Order:", response.data.Orders ? response.data.Orders[0] : null);
    } catch (e) {
        console.log("Error:", e.response ? e.response.status : e.message);
        console.log("Error Data:", e.response ? e.response.data : null);
    }
}

testOrders();
