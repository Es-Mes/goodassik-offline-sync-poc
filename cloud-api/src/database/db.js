// Use Mock database for tests, real PostgreSQL for production
let pool;

if (process.env.NODE_ENV === 'test') {
    const { MockPool, initializeMockDatabase } = require('../../tests/db-mock');
    pool = new MockPool();
    initializeMockDatabase();
} else {
    const { Pool } = require('pg');
    pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'cloud_scans_db',
        user: process.env.POSTGRES_USER || 'clouduser',
        password: process.env.POSTGRES_PASSWORD || 'cloudpass123',
    });
}

async function initializeDatabase(retries = 10, delay = 2000) {
    // In test mode, database is already initialized by db-mock.js
    if (process.env.NODE_ENV === 'test') {
        console.log('✅ Cloud database initialized (test mode)');
        return;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`⏳ Attempting to connect to PostgreSQL (attempt ${attempt}/${retries})...`);
            const client = await pool.connect();

            try {
                // Create ExamScans table
                await client.query(`
          CREATE TABLE IF NOT EXISTS ExamScans (
            Id VARCHAR(255) PRIMARY KEY,
            StudentId VARCHAR(255) NOT NULL,
            ExamId VARCHAR(255) NOT NULL,
            ImagePath TEXT NOT NULL,
            Grade INTEGER,
            Comments TEXT,
            LastModifiedAt TIMESTAMP NOT NULL,
            CreatedAt TIMESTAMP NOT NULL,
            SyncedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

                // Create index for better query performance
                await client.query(`
          CREATE INDEX IF NOT EXISTS idx_exam_scans_student 
          ON ExamScans(StudentId)
        `);

                await client.query(`
          CREATE INDEX IF NOT EXISTS idx_exam_scans_exam 
          ON ExamScans(ExamId)
        `);

                // Create CloudSyncOutbox table
                await client.query(`
          CREATE TABLE IF NOT EXISTS CloudSyncOutbox (
            Id VARCHAR(255) PRIMARY KEY,
            EntityType VARCHAR(255) NOT NULL,
            EntityId VARCHAR(255) NOT NULL,
            Action VARCHAR(50) NOT NULL,
            Status VARCHAR(50) DEFAULT 'Pending',
            Grade INTEGER,
            Comments TEXT,
            LastModifiedAt TIMESTAMP,
            RetryCount INTEGER DEFAULT 0,
            LastError TEXT,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            SyncedAt TIMESTAMP,
            CHECK(Status IN ('Pending', 'InProgress', 'Synced', 'Failed', 'Overridden', 'Skipped')),
            CHECK(Action IN ('Update'))
          )
        `);

                await client.query(`
          CREATE INDEX IF NOT EXISTS idx_cloud_sync_outbox_status 
          ON CloudSyncOutbox(Status)
        `);

                console.log('✅ Cloud database initialized');
                return; // Success!
            } finally {
                client.release();
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed:`, error.message);

            if (attempt === retries) {
                console.error('💥 Failed to connect to PostgreSQL after all retries');
                throw error;
            }

            console.log(`⏱️  Waiting ${delay / 1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function getPool() {
    return pool;
}

module.exports = {
    getPool,
    initializeDatabase
};
