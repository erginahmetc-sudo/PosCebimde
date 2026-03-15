const birFaturaService = require('./birfatura.service');

const mockSale = {
    id: 123,
    sale_code: 'SLS-2026-001',
    date: '2026-03-16T12:00:00Z',
    customer_name: 'Ahmet Yılmaz',
    tax_number: '12345678901', // TCKN
    address: 'Atatürk Cad. No:1',
    phone: '05321112233',
    items: JSON.stringify([
        {
            stock_code: 'KILIF-001',
            name: 'iPhone 15 Kılıf',
            price: 120, // Incl Tax
            quantity: 2,
            vat_rate: 20
        }
    ]),
    payment_method: 'Kredi Kartı'
};

const mockCustomer = {
    id: 456,
    name: 'Ahmet Yılmaz',
    tax_number: '12345678901',
    address: 'Atatürk Cad. No:1',
    city: 'İstanbul',
    district: 'Kadıköy',
    phone: '05321112233',
    email: 'ahmet@example.com'
};

console.log("--- Testing BirFatura Mapping ---");

const result = birFaturaService.mapSaleToOrder(mockSale, mockCustomer);

console.log("Mapped Order Structure:");
console.log(JSON.stringify(result, null, 2));

// Validations
const assertions = [
    { name: 'OrderId extraction', pass: result.OrderId === 1 },
    { name: 'OrderCode mapping', pass: result.OrderCode === 'SLS-2026-001' },
    { name: 'BillingName mapping', pass: result.BillingName === 'Ahmet Yılmaz' },
    { name: 'SSNTCNo mapping', pass: result.SSNTCNo === '12345678901' },
    { name: 'BillingCity mapping', pass: result.BillingCity === 'İstanbul' },
    { name: 'Item mapping count', pass: result.OrderDetails.length === 1 },
    { name: 'Item ProductCode', pass: result.OrderDetails[0].ProductCode === 'KILIF-001' },
    { name: 'Calculation (Tax Incl)', pass: result.TotalPaidTaxIncluding === 240 },
    { name: 'Calculation (Tax Excl)', pass: result.TotalPaidTaxExcluding === 200 }
];

console.log("\n--- Verification Results ---");
assertions.forEach(a => {
    console.log(`${a.pass ? '✅' : '❌'} ${a.name}`);
});

if (assertions.every(a => a.pass)) {
    console.log("\nAll tests passed successfully! 🚀");
} else {
    console.error("\nSome tests failed. Please review the mapping logic.");
    process.exit(1);
}
