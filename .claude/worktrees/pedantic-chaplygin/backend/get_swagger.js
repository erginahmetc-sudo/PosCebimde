const https = require('https');

const options = {
    hostname: 'api.swaggerhub.com',
    port: 443,
    path: '/apis/birfatura/orders/1.0.0',
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(data);
    });
});

req.on('error', (e) => {
    console.error(e);
});
req.end();
