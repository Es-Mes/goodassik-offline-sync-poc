const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const { createSyncOutboxEntry } = require('../services/syncService');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.NODE_ENV === 'test'
    ? path.join(__dirname, '../../test-uploads')
    : '/app/storage/scans';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create directory if it doesn't exist (for tests)
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// POST /local/scans - Upload a new scan
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { studentId, examId } = req.body;

        if (!studentId || !examId) {
            return res.status(400).json({ error: 'studentId and examId are required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const db = getDatabase();
        const scanId = uuidv4();
        const imagePath = `/storage/scans/${req.file.filename}`;
        const now = new Date().toISOString();

        // Insert into ExamScans
        const insertScan = db.prepare(`
      INSERT INTO ExamScans (Id, StudentId, ExamId, ImagePath, Grade, Comments, LastModifiedAt, CreatedAt, SyncStatus)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, 'Pending')
    `);

        insertScan.run(scanId, studentId, examId, imagePath, now, now);

        // Create sync outbox entry
        createSyncOutboxEntry('ExamScan', scanId, 'Create');

        res.status(201).json({
            success: true,
            scan: {
                Id: scanId,
                StudentId: studentId,
                ExamId: examId,
                ImagePath: imagePath,
                CreatedAt: now,
                LastModifiedAt: now,
                SyncStatus: 'Pending'
            }
        });

    } catch (error) {
        console.error('Error creating scan:', error);
        res.status(500).json({ error: 'Failed to create scan', details: error.message });
    }
});

// GET /local/scans - Get all scans
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const scans = db.prepare('SELECT * FROM ExamScans ORDER BY CreatedAt DESC').all();
        res.json({ scans });
    } catch (error) {
        console.error('Error fetching scans:', error);
        res.status(500).json({ error: 'Failed to fetch scans', details: error.message });
    }
});

// GET /local/scans/:id - Get specific scan
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const scan = db.prepare('SELECT * FROM ExamScans WHERE Id = ?').get(req.params.id);

        if (!scan) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        res.json({ scan });
    } catch (error) {
        console.error('Error fetching scan:', error);
        res.status(500).json({ error: 'Failed to fetch scan', details: error.message });
    }
});

// PATCH /local/scans/:id - Update grade and comments
router.patch('/:id', (req, res) => {
    try {
        const { grade, comments } = req.body;
        const scanId = req.params.id;

        const db = getDatabase();
        const scan = db.prepare('SELECT * FROM ExamScans WHERE Id = ?').get(scanId);

        if (!scan) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        const now = new Date().toISOString();

        // Update scan
        const update = db.prepare(`
            UPDATE ExamScans 
            SET Grade = ?, Comments = ?, LastModifiedAt = ?
            WHERE Id = ?
        `);
        update.run(grade !== undefined ? grade : scan.Grade, comments !== undefined ? comments : scan.Comments, now, scanId);

        // Create sync outbox entry for update
        createSyncOutboxEntry('ExamScan', scanId, 'Update');

        const updatedScan = db.prepare('SELECT * FROM ExamScans WHERE Id = ?').get(scanId);

        res.json({
            success: true,
            scan: updatedScan
        });
    } catch (error) {
        console.error('Error updating scan:', error);
        res.status(500).json({ error: 'Failed to update scan', details: error.message });
    }
});

module.exports = router;
