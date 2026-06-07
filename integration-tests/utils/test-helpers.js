/**
 * Integration Test Helpers - Fixed for ExamScans
 * Based on unit tests structure (StudentId, ExamId, Image)
 */

const axios = require('axios');
const sqlite3 = require('better-sqlite3');
const { Client } = require('pg');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple UUID v4 generator
function uuidv4() {
    return crypto.randomUUID();
}

// Create a test image file
function createTestImage() {
    const testImagePath = path.join(__dirname, 'test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
        // Create a minimal valid JPEG (1x1 pixel)
        const minimalJpeg = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
            0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
            0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
            0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
            0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
            0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
            0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x03, 0xFF, 0xDA, 0x00, 0x08,
            0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xBF, 0xC0,
            0x00, 0xFF, 0xD9
        ]);
        fs.writeFileSync(testImagePath, minimalJpeg);
    }
    return testImagePath;
}

// API endpoints
const LOCAL_API = 'http://localhost:3011';
const CLOUD_API = 'http://localhost:3012';

// Database connections
const getLocalDb = () => {
    return new sqlite3('C:\\Users\\PC\\Desktop\\Good Assik\\goodassik-offline-sync-poc\\local-api\\data\\local.db');
};

const getCloudDb = async () => {
    const client = new Client({
        host: 'localhost',
        port: 5433, // Test database port
        database: 'clouddb',
        user: 'clouduser',
        password: 'cloudpass123'
    });
    await client.connect();
    return client;
};

/**
 * Wait with timeout and optional retry logic
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for condition with timeout
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} timeout - Max time to wait in ms
 * @param {number} interval - Check interval in ms
 */
const waitFor = async (condition, timeout = 15000, interval = 1000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return true;
        }
        await wait(interval);
    }
    throw new Error(`Timeout after ${timeout}ms waiting for condition`);
};

/**
 * Local API Helpers
 */
const localApi = {
    createScan: async (studentId, examId) => {
        const formData = new FormData();
        formData.append('studentId', studentId);
        formData.append('examId', examId);

        const imagePath = createTestImage(); // Use global function
        formData.append('image', fs.createReadStream(imagePath), {
            filename: 'test-scan.jpg',
            contentType: 'image/jpeg'
        });

        const response = await axios.post(`${LOCAL_API}/local/scans`, formData, {
            headers: formData.getHeaders()
        });
        return response.data.scan;
    },

    getScan: async (scanId) => {
        const response = await axios.get(`${LOCAL_API}/local/scans/${scanId}`);
        return response.data.scan;
    },

    updateScan: async (scanId, updates) => {
        const response = await axios.patch(`${LOCAL_API}/local/scans/${scanId}`, updates);
        return response.data.scan;
    },

    getOutboxStatus: (entityId) => {
        const db = getLocalDb();
        const row = db.prepare('SELECT * FROM SyncOutbox WHERE EntityId = ? ORDER BY CreatedAt DESC LIMIT 1').get(entityId);
        db.close();
        return row;
    }
};

/**
 * Cloud API Helpers
 */
const cloudApi = {
    getScan: async (cloudScanId) => {
        const response = await axios.get(`${CLOUD_API}/api/sync/scans/${cloudScanId}`);
        const scan = response.data.scan;
        // PostgreSQL returns lowercase column names, convert to PascalCase for consistency
        return {
            Id: scan.id,
            StudentId: scan.studentid,
            ExamId: scan.examid,
            ImagePath: scan.imagepath,
            Grade: scan.grade,
            Comments: scan.comments,
            LastModifiedAt: scan.lastmodifiedat,
            CreatedAt: scan.createdat
        };
    },

    createScan: async (studentId, examId) => {
        // Create a scan directly in cloud for pull sync tests
        const scanId = uuidv4();
        const testImgPath = createTestImage(); // Generate test image
        const formData = new FormData();
        formData.append('scanId', scanId);
        formData.append('studentId', studentId);
        formData.append('examId', examId);
        formData.append('createdAt', new Date().toISOString());
        formData.append('image', fs.createReadStream(testImgPath));

        const response = await axios.post(
            `${CLOUD_API}/api/sync/scans/create`,  // Use the new endpoint that creates CloudSyncOutbox
            formData,
            { headers: formData.getHeaders() }
        );

        // Return the scan object
        return {
            Id: scanId,
            StudentId: studentId,
            ExamId: examId,
            ImagePath: `/storage/scans/${path.basename(testImgPath)}`,
            Grade: null,
            Comments: null,
            CreatedAt: new Date().toISOString(),
            LastModifiedAt: new Date().toISOString()
        };
    },

    updateScan: async (cloudScanId, updates) => {
        const response = await axios.patch(`${CLOUD_API}/api/sync/scans/${cloudScanId}`, updates);
        const scan = response.data.scan;
        return {
            Id: scan.id,
            StudentId: scan.studentid,
            ExamId: scan.examid,
            ImagePath: scan.imagepath,
            Grade: scan.grade,
            Comments: scan.comments,
            LastModifiedAt: scan.lastmodifiedat,
            CreatedAt: scan.createdat
        };
    },

    getAllScans: async () => {
        const response = await axios.get(`${CLOUD_API}/api/sync/scans`);
        return response.data.scans.map(scan => ({
            Id: scan.id,
            StudentId: scan.studentid,
            ExamId: scan.examid,
            ImagePath: scan.imagepath,
            Grade: scan.grade,
            Comments: scan.comments,
            LastModifiedAt: scan.lastmodifiedat,
            CreatedAt: scan.createdat
        }));
    },

    getUpdates: async (limit = 100) => {
        const response = await axios.get(`${CLOUD_API}/api/updates?limit=${limit}`);
        return response.data;
    },

    markUpdateComplete: async (updateId) => {
        const response = await axios.post(`${CLOUD_API}/api/updates/${updateId}/complete`);
        return response.data;
    }
};

/**
 * Database Query Helpers
 */
const dbHelpers = {
    // Check if scan exists in Cloud PostgreSQL
    scanExistsInCloud: async (cloudScanId) => {
        const client = await getCloudDb();
        try {
            const result = await client.query('SELECT * FROM examscans WHERE id = $1', [cloudScanId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } finally {
            await client.end();
        }
    },

    // Check Local SQLite scan
    scanExistsInLocal: (scanId) => {
        const db = getLocalDb();
        try {
            const row = db.prepare('SELECT * FROM ExamScans WHERE Id = ?').get(scanId);
            return row || null;
        } finally {
            db.close();
        }
    },

    // Get CloudSyncOutbox status
    getCloudOutboxStatus: async (entityId) => {
        const client = await getCloudDb();
        try {
            const result = await client.query('SELECT * FROM cloudsyncoutbox WHERE entityid = $1 ORDER BY createdat DESC LIMIT 1', [entityId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } finally {
            await client.end();
        }
    },

    // Clean up test data
    cleanupLocal: (scanId) => {
        const db = getLocalDb();
        try {
            db.prepare('DELETE FROM SyncOutbox WHERE EntityId = ?').run(scanId);
            db.prepare('DELETE FROM ExamScans WHERE Id = ?').run(scanId);
        } finally {
            db.close();
        }
    },

    cleanupCloud: async (cloudScanId) => {
        const client = await getCloudDb();
        try {
            await client.query('DELETE FROM cloudsyncoutbox WHERE entityid = $1', [cloudScanId]);
            await client.query('DELETE FROM examscans WHERE id = $1', [cloudScanId]);
        } finally {
            await client.end();
        }
    }
};

/**
 * Test Scenario Helpers
 */
const scenarios = {
    /**
     * Wait for sync to complete (Local → Cloud)
     * Checks that SyncOutbox status becomes "Synced"
     */
    waitForPushSync: async (scanId, timeout = 15000) => {
        return waitFor(() => {
            const outbox = localApi.getOutboxStatus(scanId);
            return outbox && outbox.Status === 'Synced';
        }, timeout);
    },

    /**
     * Wait for pull sync to complete (Cloud → Local)
     * Checks that local scan has been updated
     */
    waitForPullSync: async (scanId, expectedValue, field = 'Grade', timeout = 15000) => {
        return waitFor(async () => {
            const scan = await localApi.getScan(scanId);
            return scan && scan[field] === expectedValue;
        }, timeout);
    },

    /**
     * Create conflict scenario
     * Updates both Local and Cloud with different values and timestamps
     */
    createConflict: async (scanId, cloudScanId, localValue, cloudValue, cloudWins = true) => {
        const baseTime = Date.now();

        // Update Local first
        await localApi.updateScan(scanId, {
            Grade: localValue,
            LastModifiedAt: new Date(baseTime).toISOString()
        });

        // Update Cloud with newer/older timestamp
        const cloudTime = cloudWins ? baseTime + 5000 : baseTime - 5000;
        await cloudApi.updateScan(cloudScanId, {
            Grade: cloudValue,
            LastModifiedAt: new Date(cloudTime).toISOString()
        });

        return { localTime: baseTime, cloudTime };
    }
};

/**
 * Simplified API for tests
 */
async function uploadScan(studentId, examId) {
    const formData = new FormData();
    formData.append('studentId', studentId);
    formData.append('examId', examId);

    const imagePath = createTestImage();
    formData.append('image', fs.createReadStream(imagePath), {
        filename: 'test-scan.jpg',
        contentType: 'image/jpeg'
    });

    const response = await axios.post(`${LOCAL_API}/local/scans`, formData, {
        headers: formData.getHeaders()
    });
    return response.data;
}

async function getLocalScans() {
    const response = await axios.get(`${LOCAL_API}/local/scans`);
    return response.data;
}

async function getCloudScans() {
    const response = await axios.get(`${CLOUD_API}/api/sync/scans`);
    return response.data;
}

async function waitForSync(ms = 10000) {
    await wait(ms);
}

async function deleteScan(scanId) {
    const response = await axios.delete(`${LOCAL_API}/local/scans/${scanId}`);
    return response.data;
}

async function updateScan(scanId, updates) {
    const response = await axios.patch(`${LOCAL_API}/local/scans/${scanId}`, updates);
    return response.data;
}

module.exports = {
    wait,
    waitFor,
    localApi,
    cloudApi,
    dbHelpers,
    scenarios,
    LOCAL_API,
    CLOUD_API,
    uploadScan,
    getLocalScans,
    getCloudScans,
    waitForSync,
    deleteScan,
    updateScan
};
