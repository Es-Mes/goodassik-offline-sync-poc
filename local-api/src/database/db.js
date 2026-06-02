const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/local.db');
let db = null;

function getDatabase() {
    if (!db) {
        db = new Database(DB_PATH, { verbose: console.log });
    }
    return db;
}

function initializeDatabase() {
    const db = getDatabase();

    // Create ExamScans table
    db.exec(`
    CREATE TABLE IF NOT EXISTS ExamScans (
      Id TEXT PRIMARY KEY,
      StudentId TEXT NOT NULL,
      ExamId TEXT NOT NULL,
      ImagePath TEXT NOT NULL,
      CreatedAt TEXT NOT NULL,
      SyncStatus TEXT DEFAULT 'Pending',
      CHECK(SyncStatus IN ('Pending', 'Syncing', 'Synced', 'Failed'))
    )
  `);

    // Create SyncOutbox table
    db.exec(`
    CREATE TABLE IF NOT EXISTS SyncOutbox (
      Id TEXT PRIMARY KEY,
      EntityType TEXT NOT NULL,
      EntityId TEXT NOT NULL,
      Action TEXT NOT NULL,
      Status TEXT DEFAULT 'Pending',
      RetryCount INTEGER DEFAULT 0,
      LastError TEXT,
      CreatedAt TEXT NOT NULL,
      SyncedAt TEXT,
      CHECK(Status IN ('Pending', 'InProgress', 'Synced', 'Failed')),
      CHECK(Action IN ('Create', 'Update', 'Delete'))
    )
  `);

    console.log('✅ Local database initialized');
}

module.exports = {
    getDatabase,
    initializeDatabase
};
