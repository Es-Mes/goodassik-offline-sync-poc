const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { initializeDatabase } = require('./database/db');
const syncRouter = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
(async () => {
    await initializeDatabase();
})();

// Routes
app.use('/api/sync', syncRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'cloud-api', timestamp: new Date().toISOString() });
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`☁️  Cloud API running on port ${PORT}`);
    });
}

module.exports = app;
