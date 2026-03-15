// backend/debug.js

const express = require('express');
const router = express.Router();

// Debug endpoint to test BirFatura integration
router.get('/test-birfatura', (req, res) => {
    // Add logic to test BirFatura integration
    res.json({ message: 'BirFatura integration test successful' });
});

// Endpoint to list sales from the database
router.get('/sales', async (req, res) => {
    try {
        // Add logic to fetch sales from database
        const sales = []; // Replace with actual database fetching logic
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching sales' });
    }
});

// Endpoint to validate API connectivity
router.get('/validate-api', (req, res) => {
    res.json({ message: 'API is working' });
});

module.exports = router;