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

async function syncScanToCloud(scan, outboxEntry, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

    try {
        // Check if this is a Delete action
        if (outboxEntry.Action === 'Delete') {
            console.log(`🗑️  Deleting scan ${outboxEntry.EntityId} from cloud`);
            const response = await axios.delete(
                `${CLOUD_API_URL}/api/sync/scans/${outboxEntry.EntityId}`,
                { timeout: 10000 }
            );
            console.log(`✅ Delete confirmed from cloud`);
            return response.data;
        }

        // Check if this is an Update action (only grade/comments changed)
        if (outboxEntry.Action === 'Update') {
            // For updates, only send grade and comments via PATCH
            console.log(`📝 Updating scan ${scan.Id}: grade=${scan.Grade}, comments="${scan.Comments}"`);
            const response = await axios.patch(
                `${CLOUD_API_URL}/api/sync/scans/${scan.Id}`,
                {
                    grade: scan.Grade,
                    comments: scan.Comments,
                    lastModifiedAt: scan.LastModifiedAt
                },
                { timeout: 10000 }
            );
            console.log(`✅ Update response: grade=${response.data.scan?.grade}, comments="${response.data.scan?.comments}"`);
            return response.data;
        }

        // For Create action, send the full scan with image
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
        // Clean up compressed file on error (only for Create action)
        if (outboxEntry.Action === 'Create') {
            const compressedPath = `${path.join('/app/storage/scans', path.basename(scan.ImagePath))}.gz`;
            if (fs.existsSync(compressedPath)) {
                try {
                    fs.unlinkSync(compressedPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }

        // Check if this is a network error and we should retry
        const isNetworkError = error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            (error.response && error.response.status >= 500);

        if (isNetworkError && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCount];
            console.log(`⚠️  Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return syncScanToCloud(scan, outboxEntry, retryCount + 1);
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

async function downloadScanFromCloud(scanId) {
    try {
        // Download the scan data including compressed image
        const response = await axios.get(
            `${CLOUD_API_URL}/api/sync/scans/${scanId}/download`,
            {
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        // The response body is the compressed image
        const compressedImage = Buffer.from(response.data);

        // Decompress the image
        const gunzip = promisify(zlib.gunzip);
        const decompressedImage = await gunzip(compressedImage);

        // Save to local storage
        const imageDir = '/app/data/images';
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }

        const imagePath = path.join(imageDir, `${scanId}.jpg`);
        fs.writeFileSync(imagePath, decompressedImage);

        console.log(`📥 Downloaded and decompressed image for scan ${scanId}`);

        // Return both the image path and scan metadata from headers
        return {
            imagePath,
            studentId: response.headers['x-student-id'],
            examId: response.headers['x-exam-id'],
            grade: response.headers['x-grade'] ? parseInt(response.headers['x-grade']) : null,
            comments: response.headers['x-comments'] || null,
            createdAt: response.headers['x-created-at'],
            lastModifiedAt: response.headers['x-last-modified-at']
        };
    } catch (error) {
        console.error(`Error downloading scan ${scanId} from cloud:`, error.message);
        throw error;
    }
}

module.exports = {
    checkCloudConnection,
    syncScanToCloud,
    fetchCloudUpdates,
    completeCloudUpdate,
    downloadScanFromCloud
};
