const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);

const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://cloud-api:3002';

async function checkCloudConnection() {
    try {
        const response = await axios.get(`${CLOUD_API_URL}/health`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function compressFile(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const compressed = await gzip(fileBuffer);

        const compressedPath = `${filePath}.gz`;
        fs.writeFileSync(compressedPath, compressed);

        const originalSize = fileBuffer.length;
        const compressedSize = compressed.length;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

        console.log(`📦 Compressed: ${originalSize} → ${compressedSize} bytes (${compressionRatio}% reduction)`);

        return compressedPath;
    } catch (error) {
        console.error('Error compressing file:', error);
        throw error;
    }
}

async function syncScanToCloud(scan, outboxEntry) {
    try {
        // Get the full file path
        const filePath = path.join('/app/storage/scans', path.basename(scan.ImagePath));

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Compress the file
        const compressedPath = await compressFile(filePath);

        // Create form data
        const formData = new FormData();
        formData.append('scanId', scan.Id);
        formData.append('studentId', scan.StudentId);
        formData.append('examId', scan.ExamId);
        formData.append('createdAt', scan.CreatedAt);
        formData.append('image', fs.createReadStream(compressedPath), {
            filename: path.basename(filePath),
            contentType: 'application/gzip'
        });

        // Send to cloud
        const response = await axios.post(
            `${CLOUD_API_URL}/api/sync/scans`,
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 60000 // 60 seconds timeout
            }
        );

        // Clean up compressed file
        try {
            fs.unlinkSync(compressedPath);
        } catch (error) {
            console.warn('Failed to delete compressed file:', error.message);
        }

        return response.data;

    } catch (error) {
        // Clean up compressed file on error
        const compressedPath = `${path.join('/app/storage/scans', path.basename(scan.ImagePath))}.gz`;
        if (fs.existsSync(compressedPath)) {
            try {
                fs.unlinkSync(compressedPath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        throw error;
    }
}

async function fetchCloudUpdates() {
    try {
        const response = await axios.get(
            `${CLOUD_API_URL}/api/sync/updates`,
            { timeout: 10000 }
        );
        // API returns { updates: [...] }, extract the array
        const data = response.data;
        return Array.isArray(data?.updates) ? data.updates : [];
    } catch (error) {
        console.error('Error fetching cloud updates:', error.message);
        return []; // Return empty array instead of throwing
    }
}

async function completeCloudUpdate(updateId, status) {
    try {
        await axios.post(
            `${CLOUD_API_URL}/api/sync/updates/${updateId}/complete`,
            { status },
            { timeout: 5000 }
        );
    } catch (error) {
        console.error(`Error completing cloud update ${updateId}:`, error.message);
        throw error;
    }
}

module.exports = {
    checkCloudConnection,
    syncScanToCloud,
    fetchCloudUpdates,
    completeCloudUpdate
};
