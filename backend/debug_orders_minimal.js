
async function testOrdersMinimal() {
    try {
        const response = await fetch('https://www.poscebimde.com/api/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': 'kasapos-2026-secret-api-token'
            },
            body: JSON.stringify({}) // No filters
        });
        const data = await response.json();
        console.log("Success:", response.status);
        console.log("Data length:", data.Orders ? data.Orders.length : 0);
        if (data.Orders && data.Orders.length > 0) {
            console.log("Last Sale Date:", data.Orders[0].OrderDate);
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testOrdersMinimal();
