const Database = require('better-sqlite3');

let db = null;

function initializeMockDatabase() {
    // Create in-memory SQLite database
    db = new Database(':memory:');

    // Create ExamScans table
    db.exec(`
        CREATE TABLE IF NOT EXISTS ExamScans (
            Id TEXT PRIMARY KEY,
            StudentId TEXT NOT NULL,
            ExamId TEXT NOT NULL,
            ImagePath TEXT NOT NULL,
            Grade INTEGER,
            Comments TEXT,
            LastModifiedAt TEXT NOT NULL,
            CreatedAt TEXT NOT NULL,
            SyncedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create CloudSyncOutbox table
    db.exec(`
        CREATE TABLE IF NOT EXISTS CloudSyncOutbox (
            Id TEXT PRIMARY KEY,
            EntityType TEXT NOT NULL,
            EntityId TEXT NOT NULL,
            Action TEXT NOT NULL,
            Status TEXT DEFAULT 'Pending',
            Grade INTEGER,
            Comments TEXT,
            LastModifiedAt TEXT,
            RetryCount INTEGER DEFAULT 0,
            LastError TEXT,
            CreatedAt TEXT NOT NULL,
            SyncedAt TEXT,
            CHECK(Status IN ('Pending', 'InProgress', 'Synced', 'Failed', 'Overridden', 'Skipped')),
            CHECK(Action IN ('Create', 'Update', 'Delete'))
        )
    `);

    console.log('✅ Mock Cloud database initialized (SQLite in-memory)');
    return db;
}

function getMockDatabase() {
    if (!db) {
        db = initializeMockDatabase();
    }
    return db;
}

function closeMockDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

// Mock Pool interface to match pg.Pool
class MockPool {
    constructor() {
        this.db = getMockDatabase();
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                // Convert PostgreSQL $1, $2 placeholders to SQLite ?
                let sqliteSql = sql.replace(/\$(\d+)/g, '?');

                // Handle different SQL query types
                if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
                    const stmt = this.db.prepare(sqliteSql);
                    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();

                    // Convert column names to lowercase to match PostgreSQL behavior
                    const lowercaseRows = rows.map(row => {
                        const newRow = {};
                        for (const key in row) {
                            newRow[key.toLowerCase()] = row[key];
                        }
                        return newRow;
                    });

                    resolve({ rows: lowercaseRows });
                } else if (sqliteSql.trim().toUpperCase().startsWith('INSERT')) {
                    const stmt = this.db.prepare(sqliteSql);
                    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
                    resolve({ rowCount: result.changes });
                } else if (sqliteSql.trim().toUpperCase().startsWith('UPDATE')) {
                    const stmt = this.db.prepare(sqliteSql);
                    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
                    resolve({ rowCount: result.changes });
                } else if (sqliteSql.trim().toUpperCase().startsWith('DELETE')) {
                    const stmt = this.db.prepare(sqliteSql);
                    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
                    resolve({ rowCount: result.changes });
                } else {
                    // For CREATE TABLE and other DDL
                    this.db.exec(sqliteSql);
                    resolve({ rowCount: 0 });
                }
            } catch (error) {
                console.error('[Mock DB Error]', error.message);
                console.error('[SQL]', sqliteSql);
                console.error('[Params]', params);
                reject(error);
            }
        });
    }

    async connect() {
        return {
            query: this.query.bind(this),
            release: () => { }
        };
    }

    async end() {
        closeMockDatabase();
    }
}

module.exports = {
    initializeMockDatabase,
    getMockDatabase,
    closeMockDatabase,
    MockPool
};
