const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/app/data/local.db');
let db = null;

function getDatabase() {
    if (!db) {
        // Wait for database to be created by local-api
        let retries = 10;
        while (retries > 0) {
            try {
                db = new Database(DB_PATH, { readonly: false });
                console.log('✅ Connected to local database');
                break;
            } catch (error) {
                console.log(`⏳ Waiting for database... (${retries} retries left)`);
                retries--;
                if (retries === 0) throw error;
                // Sleep for 2 seconds
                const now = Date.now();
                while (Date.now() - now < 2000) { }
            }
        }
    }
    return db;
}

function getPendingSyncEntries() {
    const db = getDatabase();
    return db.prepare(`
    SELECT * FROM SyncOutbox 
    WHERE Status = 'Pending' 
    ORDER BY CreatedAt ASC
  `).all();
}

function updateSyncOutboxStatus(outboxId, status, error = null) {
    const db = getDatabase();

    if (status === 'Synced' || status === 'Overridden' || status === 'Skipped') {
        const update = db.prepare(`
      UPDATE SyncOutbox 
      SET Status = ?, SyncedAt = ?, LastError = NULL
      WHERE Id = ?
    `);
        update.run(status, new Date().toISOString(), outboxId);
    } else if (status === 'Failed') {
        const update = db.prepare(`
      UPDATE SyncOutbox 
      SET Status = ?, RetryCount = RetryCount + 1, LastError = ?
      WHERE Id = ?
    `);
        update.run(status, error, outboxId);
    } else {
        const update = db.prepare(`
      UPDATE SyncOutbox 
      SET Status = ?
      WHERE Id = ?
    `);
        update.run(status, outboxId);
    }
}

function getScanById(scanId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM ExamScans WHERE Id = ?').get(scanId);
}

function updateScanSyncStatus(scanId, status) {
    const db = getDatabase();
    const update = db.prepare('UPDATE ExamScans SET SyncStatus = ? WHERE Id = ?');
    update.run(status, scanId);
}

function updateLocalScan(scanId, grade, comments, lastModifiedAt) {
    const db = getDatabase();
    console.log(`🔧 updateLocalScan called: scanId=${scanId}, grade=${grade}, comments="${comments}", lastModifiedAt=${lastModifiedAt}`);
    const update = db.prepare(`
        UPDATE ExamScans 
        SET Grade = ?, Comments = ?, LastModifiedAt = ?
        WHERE Id = ?
    `);
    const result = update.run(grade, comments, lastModifiedAt, scanId);
    console.log(`🔧 Update result: changes=${result.changes}`);
}

function findPendingSyncEntryByEntityId(entityId) {
    const db = getDatabase();
    return db.prepare(`
        SELECT * FROM SyncOutbox 
        WHERE EntityId = ? AND Status = 'Pending'
        ORDER BY CreatedAt DESC
        LIMIT 1
    `).get(entityId);
}

function createLocalScan(scanData) {
    const db = getDatabase();
    const insert = db.prepare(`
        INSERT INTO ExamScans (
            Id, StudentId, ExamId, ImagePath, Grade, Comments,
            LastModifiedAt, CreatedAt, SyncStatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
        scanData.Id,
        scanData.StudentId,
        scanData.ExamId,
        scanData.ImagePath,
        scanData.Grade || null,
        scanData.Comments || null,
        scanData.LastModifiedAt,
        scanData.CreatedAt,
        'Synced' // Set as Synced since it came from cloud
    );
}

function deleteLocalScan(scanId) {
    const db = getDatabase();

    // Get scan info before deleting (for image cleanup)
    const scan = getScanById(scanId);

    if (scan) {
        // Delete image file if exists
        const fs = require('fs');
        const path = require('path');
        const imagePath = path.join('/app/data/images', path.basename(scan.ImagePath));

        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️  Deleted local image file: ${imagePath}`);
        }
    }

    // Delete from database
    const deleteStmt = db.prepare('DELETE FROM ExamScans WHERE Id = ?');
    deleteStmt.run(scanId);
}

module.exports = {
    getDatabase,
    getPendingSyncEntries,
    updateSyncOutboxStatus,
    getScanById,
    updateScanSyncStatus,
    updateLocalScan,
    findPendingSyncEntryByEntityId,
    createLocalScan,
    deleteLocalScan
};
