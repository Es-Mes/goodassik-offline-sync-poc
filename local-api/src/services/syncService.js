const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');

function createSyncOutboxEntry(entityType, entityId, action) {
    const db = getDatabase();
    const outboxId = uuidv4();
    const createdAt = new Date().toISOString();

    const insert = db.prepare(`
    INSERT INTO SyncOutbox (Id, EntityType, EntityId, Action, Status, RetryCount, CreatedAt)
    VALUES (?, ?, ?, ?, 'Pending', 0, ?)
  `);

    insert.run(outboxId, entityType, entityId, action, createdAt);

    console.log(`📝 Created sync outbox entry: ${outboxId} for ${entityType}:${entityId}`);

    return outboxId;
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

function getPendingSyncEntries() {
    const db = getDatabase();
    return db.prepare(`
    SELECT * FROM SyncOutbox 
    WHERE Status = 'Pending' 
    ORDER BY CreatedAt ASC
  `).all();
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

module.exports = {
    createSyncOutboxEntry,
    updateSyncOutboxStatus,
    getPendingSyncEntries,
    getScanById,
    updateScanSyncStatus
};
