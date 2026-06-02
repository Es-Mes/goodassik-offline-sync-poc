const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'cloud_scans_db',
    user: process.env.POSTGRES_USER || 'clouduser',
    password: process.env.POSTGRES_PASSWORD || 'cloudpass123',
});

async function initializeDatabase(retries = 10, delay = 2000) {
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
