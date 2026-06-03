const express = require('express');
const { getDatabase } = require('../database/db');

const router = express.Router();

// GET /local/sync/status - Get sync status
router.get('/status', (req, res) => {
    try {
        const db = getDatabase();

        const pending = db.prepare('SELECT COUNT(*) as count FROM SyncOutbox WHERE Status = ?').get('Pending');
        const synced = db.prepare('SELECT COUNT(*) as count FROM SyncOutbox WHERE Status = ?').get('Synced');
        const failed = db.prepare('SELECT COUNT(*) as count FROM SyncOutbox WHERE Status = ?').get('Failed');
        const inProgress = db.prepare('SELECT COUNT(*) as count FROM SyncOutbox WHERE Status = ?').get('InProgress');

        res.json({
            status: {
                pending: pending.count,
                synced: synced.count,
                failed: failed.count,
                inProgress: inProgress.count
            }
        });
    } catch (error) {
        console.error('Error fetching sync status:', error);
        res.status(500).json({ error: 'Failed to fetch sync status', details: error.message });
    }
});

// GET /local/sync/outbox - Get all outbox entries
router.get('/outbox', (req, res) => {
    try {
        const db = getDatabase();
        const entries = db.prepare('SELECT * FROM SyncOutbox ORDER BY CreatedAt DESC').all();
        res.json({ outbox: entries });
    } catch (error) {
        console.error('Error fetching outbox:', error);
        res.status(500).json({ error: 'Failed to fetch outbox', details: error.message });
    }
});

// GET /local/sync/pending - Get pending sync entries
router.get('/pending', (req, res) => {
    try {
        const db = getDatabase();
        const entries = db.prepare(`
      SELECT * FROM SyncOutbox 
      WHERE Status = 'Pending' 
      ORDER BY CreatedAt ASC
    `).all();
        res.json({ entries });
    } catch (error) {
        console.error('Error fetching pending entries:', error);
        res.status(500).json({ error: 'Failed to fetch pending entries', details: error.message });
    }
});

module.exports = router;
