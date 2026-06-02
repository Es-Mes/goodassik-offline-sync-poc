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

    if (status === 'Synced') {
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
    const update = db.prepare(`
        UPDATE ExamScans 
        SET Grade = ?, Comments = ?, LastModifiedAt = ?
        WHERE Id = ?
    `);
    update.run(grade, comments, lastModifiedAt, scanId);
}

module.exports = {
    getDatabase,
    getPendingSyncEntries,
    updateSyncOutboxStatus,
    getScanById,
    updateScanSyncStatus,
    updateLocalScan
};
