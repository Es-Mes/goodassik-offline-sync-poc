const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { initializeDatabase } = require('./database/db');
const scansRouter = require('./routes/scans');
const syncRouter = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Routes
app.use('/local/scans', scansRouter);
app.use('/local/sync', syncRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'local-api', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Local API running on port ${PORT}`);
});

module.exports = app;
