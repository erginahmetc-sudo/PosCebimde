async function testOrders() {
    try {
        const response = await fetch('http://localhost:3001/api/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': 'kasapos-2026-secret-api-token'
            },
            body: JSON.stringify({
                "startDateTime": "15.01.2000 00:00:00",
                "endDateTime": "15.01.2035 23:59:59"
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
