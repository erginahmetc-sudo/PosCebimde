async function testOrders() {
    try {
        const response = await fetch('https://www.poscebimde.com/api/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': 'kasapos-2026-secret-api-token'
            },
            body: JSON.stringify({
                "startDateTime": "10.03.2026 00:00:00",
                "endDateTime": "10.03.2026 23:59:59"
            })
        });
        const data = await response.json();
        console.log("Success:", response.status);
        console.log("Data length:", data.Orders ? data.Orders.length : 0);
        console.log("First Order:", data.Orders && data.Orders.length > 0 ? JSON.stringify(data.Orders[0], null, 2) : null);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testOrders();
