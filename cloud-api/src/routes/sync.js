const express = require('express');
const multer = require('multer');
const path = require('path');
const { getPool } = require('../database/db');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/app/storage/scans');
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
        await pool.query(
            `INSERT INTO ExamScans (Id, StudentId, ExamId, ImagePath, CreatedAt)
       VALUES ($1, $2, $3, $4, $5)`,
            [scanId, studentId, examId, imagePath, createdAt]
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
            'SELECT * FROM ExamScans ORDER BY SyncedAt DESC'
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

module.exports = router;
