const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../database/db');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.NODE_ENV === 'test'
    ? path.join(__dirname, '../../tests/test-uploads')
    : '/app/storage/scans';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create directory if it doesn't exist (for tests)
        if (process.env.NODE_ENV === 'test') {
            const fs = require('fs');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Keep the original filename sent from local API
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit (for compressed files)
});

// POST /api/sync/scans - Receive synced scan from local API
router.post('/scans', upload.single('image'), async (req, res) => {
    const pool = getPool();

    try {
        const { scanId, studentId, examId, createdAt } = req.body;

        if (!scanId || !studentId || !examId || !createdAt) {
            return res.status(400).json({
                error: 'scanId, studentId, examId, and createdAt are required'
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const imagePath = `/storage/scans/${req.file.filename}`;

        // Check if scan already exists (idempotency)
        const existingResult = await pool.query(
            'SELECT Id FROM ExamScans WHERE Id = $1',
            [scanId]
        );

        if (existingResult.rows.length > 0) {
            console.log(`⚠️  Scan ${scanId} already exists in cloud, skipping`);
            return res.json({
                success: true,
                message: 'Scan already synced',
                scanId
            });
        }

        // Insert into cloud database
        const now = new Date().toISOString();
        await pool.query(
            `INSERT INTO ExamScans (Id, StudentId, ExamId, ImagePath, Grade, Comments, LastModifiedAt, CreatedAt)
       VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6)`,
            [scanId, studentId, examId, imagePath, now, createdAt]
        );

        console.log(`✅ Synced scan ${scanId} to cloud`);

        res.status(201).json({
            success: true,
            message: 'Scan synced successfully',
            scanId
        });

    } catch (error) {
        console.error('Error syncing scan:', error);
        res.status(500).json({
            error: 'Failed to sync scan',
            details: error.message
        });
    }
});

// GET /api/sync/scans - Get all synced scans (for verification)
router.get('/scans', async (req, res) => {
    const pool = getPool();

    try {
        const result = await pool.query(
            'SELECT * FROM ExamScans ORDER BY CreatedAt DESC'
        );

        res.json({ scans: result.rows });
    } catch (error) {
        console.error('Error fetching scans:', error);
        res.status(500).json({
            error: 'Failed to fetch scans',
            details: error.message
        });
    }
});

// GET /api/sync/scans/:id - Get specific scan
router.get('/scans/:id', async (req, res) => {
    const pool = getPool();

    try {
        const result = await pool.query(
            'SELECT * FROM ExamScans WHERE Id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        res.json({ scan: result.rows[0] });
    } catch (error) {
        console.error('Error fetching scan:', error);
        res.status(500).json({
            error: 'Failed to fetch scan',
            details: error.message
        });
    }
});

// PATCH /api/sync/scans/:id - Update grade and comments in cloud
router.patch('/scans/:id', async (req, res) => {
    const pool = getPool();

    try {
        const { grade, comments } = req.body;
        const scanId = req.params.id;

        // Check if scan exists
        const existingResult = await pool.query(
            'SELECT * FROM ExamScans WHERE Id = $1',
            [scanId]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        const scan = existingResult.rows[0];
        const now = new Date().toISOString();

        // Update scan
        await pool.query(
            `UPDATE ExamScans 
             SET Grade = $1, Comments = $2, LastModifiedAt = $3
             WHERE Id = $4`,
            [
                grade !== undefined ? grade : scan.grade,
                comments !== undefined ? comments : scan.comments,
                now,
                scanId
            ]
        );

        // Create CloudSyncOutbox entry
        await pool.query(
            `INSERT INTO CloudSyncOutbox (Id, EntityType, EntityId, Action, Status, Grade, Comments, LastModifiedAt, CreatedAt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), 'ExamScan', scanId, 'Update', 'Pending', grade, comments, now, now]
        );

        const updatedResult = await pool.query(
            'SELECT * FROM ExamScans WHERE Id = $1',
            [scanId]
        );

        console.log(`✅ Updated scan ${scanId} in cloud, queued for pull`);

        res.json({
            success: true,
            scan: updatedResult.rows[0]
        });
    } catch (error) {
        console.error('Error updating scan:', error);
        res.status(500).json({
            error: 'Failed to update scan',
            details: error.message
        });
    }
});

// GET /api/sync/updates - Get pending updates to pull to local
router.get('/updates', async (req, res) => {
    const pool = getPool();

    try {
        const result = await pool.query(
            `SELECT * FROM CloudSyncOutbox 
             WHERE Status = 'Pending'
             ORDER BY CreatedAt ASC`
        );

        res.json({ updates: result.rows });
    } catch (error) {
        console.error('Error fetching updates:', error);
        res.status(500).json({
            error: 'Failed to fetch updates',
            details: error.message
        });
    }
});

// POST /api/sync/updates/:id/complete - Mark update as synced
router.post('/updates/:id/complete', async (req, res) => {
    const pool = getPool();

    try {
        const { status } = req.body; // 'Synced', 'Overridden', 'Skipped', 'Failed'
        const updateId = req.params.id;

        if (status === 'Failed') {
            // Mark as Failed with incremented retry count
            await pool.query(
                `UPDATE CloudSyncOutbox 
                 SET Status = $1, RetryCount = RetryCount + 1
                 WHERE Id = $2`,
                [status, updateId]
            );
        } else {
            // Mark as completed (Synced, Overridden, Skipped)
            await pool.query(
                `UPDATE CloudSyncOutbox 
                 SET Status = $1, SyncedAt = $2
                 WHERE Id = $3`,
                [status, new Date().toISOString(), updateId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error completing update:', error);
        res.status(500).json({
            error: 'Failed to complete update',
            details: error.message
        });
    }
});

module.exports = router;
