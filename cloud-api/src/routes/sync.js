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

// POST /api/sync/scans/create - Create new scan directly in cloud (with pull sync)
router.post('/scans/create', upload.single('image'), async (req, res) => {
    const pool = getPool();

    try {
        const { scanId, studentId, examId, createdAt } = req.body;
        const finalScanId = scanId || uuidv4();
        const finalCreatedAt = createdAt || new Date().toISOString();

        if (!studentId || !examId) {
            return res.status(400).json({
                error: 'studentId and examId are required'
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const imagePath = `/storage/scans/${req.file.filename}`;
        const now = new Date().toISOString();

        // Insert into cloud database
        await pool.query(
            `INSERT INTO ExamScans (Id, StudentId, ExamId, ImagePath, Grade, Comments, LastModifiedAt, CreatedAt)
             VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6)`,
            [finalScanId, studentId, examId, imagePath, now, finalCreatedAt]
        );

        // Create CloudSyncOutbox entry for pull sync
        await pool.query(
            `INSERT INTO CloudSyncOutbox (Id, EntityType, EntityId, Action, Status, StudentId, ExamId, ImagePath, LastModifiedAt, EntityCreatedAt, CreatedAt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [uuidv4(), 'ExamScan', finalScanId, 'Create', 'Pending', studentId, examId, imagePath, now, finalCreatedAt, now]
        );

        console.log(`✅ Created scan ${finalScanId} in cloud (queued for pull)`);

        res.status(201).json({
            success: true,
            message: 'Scan created successfully',
            scanId: finalScanId
        });

    } catch (error) {
        console.error('Error creating scan in cloud:', error);
        res.status(500).json({
            error: 'Failed to create scan',
            details: error.message
        });
    }
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
        // Support both lowercase and PascalCase for compatibility
        const grade = req.body.grade !== undefined ? req.body.grade : req.body.Grade;
        const comments = req.body.comments !== undefined ? req.body.comments : req.body.Comments;
        const lastModifiedAt = req.body.lastModifiedAt || req.body.LastModifiedAt;
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

        // Conflict detection: if lastModifiedAt is provided, check if cloud is newer
        if (lastModifiedAt) {
            // PostgreSQL returns Date objects, convert to timestamp directly
            const cloudTime = scan.lastmodifiedat instanceof Date
                ? scan.lastmodifiedat.getTime()
                : new Date(scan.lastmodifiedat).getTime();
            const clientTime = new Date(lastModifiedAt).getTime();

            console.log(`🔍 Conflict check for ${scanId}: cloud=${scan.lastmodifiedat} (${cloudTime}), client=${lastModifiedAt} (${clientTime})`);

            if (cloudTime > clientTime) {
                // Cloud is newer - reject the update
                console.log(`⚠️  Conflict detected for scan ${scanId}: cloud is newer`);
                return res.status(409).json({
                    error: 'Conflict: cloud version is newer',
                    cloudScan: scan
                });
            }
        }

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

// DELETE /api/sync/scans/:id - Delete scan from cloud
router.delete('/scans/:id', async (req, res) => {
    const pool = getPool();

    try {
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

        // Create CloudSyncOutbox entry for delete (so local can pull it)
        await pool.query(
            `INSERT INTO CloudSyncOutbox (Id, EntityType, EntityId, Action, Status, CreatedAt)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [uuidv4(), 'ExamScan', scanId, 'Delete', 'Pending', now]
        );

        // Delete scan from database
        await pool.query('DELETE FROM ExamScans WHERE Id = $1', [scanId]);

        // Delete image file if exists
        const fs = require('fs');
        const path = require('path');
        const filename = path.basename(scan.imagepath);
        const imagePath = path.join('/app/storage/scans', filename);

        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️  Deleted image file: ${imagePath}`);
        }

        console.log(`🗑️  Deleted scan ${scanId} from cloud (queued for pull)`);

        res.json({
            success: true,
            message: 'Scan deleted successfully',
            deletedId: scanId
        });
    } catch (error) {
        console.error('Error deleting scan:', error);
        res.status(500).json({
            error: 'Failed to delete scan',
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

// GET /api/sync/scans/:id/download - Download compressed image for pull sync
router.get('/scans/:id/download', async (req, res) => {
    const pool = getPool();
    const fs = require('fs');
    const zlib = require('zlib');
    const { promisify } = require('util');
    const gzip = promisify(zlib.gzip);

    try {
        const scanId = req.params.id;

        // Get scan info including image path
        const result = await pool.query(
            'SELECT * FROM ExamScans WHERE Id = $1',
            [scanId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        const scan = result.rows[0];

        // Extract just the filename from the image path
        const path = require('path');
        const filename = path.basename(scan.imagepath);
        const imagePath = path.join('/app/storage/scans', filename);

        // Read and compress the image
        if (!fs.existsSync(imagePath)) {
            console.error(`Image file not found: ${imagePath}`);
            return res.status(404).json({ error: 'Image file not found' });
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const compressed = await gzip(imageBuffer);

        // Send compressed image with scan metadata in headers
        res.set({
            'Content-Type': 'application/gzip',
            'X-Student-Id': scan.studentid,
            'X-Exam-Id': scan.examid,
            'X-Grade': scan.grade || '',
            'X-Comments': scan.comments || '',
            'X-Created-At': scan.createdat,
            'X-Last-Modified-At': scan.lastmodifiedat
        });

        res.send(compressed);
    } catch (error) {
        console.error('Error downloading scan:', error);
        res.status(500).json({
            error: 'Failed to download scan',
            details: error.message
        });
    }
});

module.exports = router;
