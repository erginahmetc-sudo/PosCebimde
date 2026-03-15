const axios = require('axios');

async function testSecurity() {
    const endpoints = [
        '/api/orders/',
        '/api/orderStatus/',
        '/api/paymentMethods/'
    ];

    console.log("--- Testing BirFatura Security ---");

    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint} with WRONG token...`);
            await axios.post(`http://localhost:5000${endpoint}`, {}, {
                headers: { 'token': 'wrong-token-123' }
            });
            console.error(`❌ FAIL: ${endpoint} accepted a wrong token!`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                console.log(`✅ PASS: ${endpoint} rejected wrong token (401).`);
            } else {
                console.error(`❌ FAIL: ${endpoint} returned unexpected status: ${err.response?.status || err.message}`);
            }
        }

        try {
            console.log(`Testing ${endpoint} with NO token...`);
            await axios.post(`http://localhost:5000${endpoint}`, {});
            console.error(`❌ FAIL: ${endpoint} accepted an empty token!`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                console.log(`✅ PASS: ${endpoint} rejected empty token (401).`);
            } else {
                console.error(`❌ FAIL: ${endpoint} returned unexpected status: ${err.response?.status || err.message}`);
            }
        }
    }

    console.log("\nSecurity tests completed.");
}

testSecurity();
