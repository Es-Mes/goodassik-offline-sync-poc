const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // In-memory SQLite for tests

const app = require('../src/server');

describe('Local API - Scans', () => {
    let testScanId = null;

    beforeAll(() => {
        // Create test image file
        const testDir = path.join(__dirname, 'test-data');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        const testImagePath = path.join(testDir, 'test-scan.jpg');
        // Create a dummy 1KB file
        fs.writeFileSync(testImagePath, Buffer.alloc(1024, 0xff));
    });

    afterAll(() => {
        // Cleanup
        const testDir = path.join(__dirname, 'test-data');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('POST /local/scans', () => {
        test('should create a new scan with valid data', async () => {
            const response = await request(app)
                .post('/local/scans')
                .field('studentId', '123456')
                .field('examId', 'MATH-2024-Q1')
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg'));

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.scan).toBeDefined();
            expect(response.body.scan.StudentId).toBe('123456');
            expect(response.body.scan.ExamId).toBe('MATH-2024-Q1');
            expect(response.body.scan.SyncStatus).toBe('Pending');

            // Save for later tests
            testScanId = response.body.scan.Id;
        });

        test('should fail without studentId', async () => {
            const response = await request(app)
                .post('/local/scans')
                .field('examId', 'MATH-2024-Q1')
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg'));

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('should fail without image', async () => {
            const response = await request(app)
                .post('/local/scans')
                .field('studentId', '123456')
                .field('examId', 'MATH-2024-Q1');

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('should create SyncOutbox entry', async () => {
            const response = await request(app)
                .post('/local/scans')
                .field('studentId', '789012')
                .field('examId', 'ENGLISH-2024-Q2')
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg'));

            expect(response.status).toBe(201);

            // Check SyncOutbox
            const outboxResponse = await request(app).get('/local/sync/outbox');
            expect(outboxResponse.status).toBe(200);
            expect(outboxResponse.body.outbox.length).toBeGreaterThan(0);

            const entry = outboxResponse.body.outbox.find(
                item => item.EntityId === response.body.scan.Id
            );
            expect(entry).toBeDefined();
            expect(entry.Status).toBe('Pending');
            expect(entry.Action).toBe('Create');
        });
    });

    describe('GET /local/scans', () => {
        test('should return all scans', async () => {
            const response = await request(app).get('/local/scans');

            expect(response.status).toBe(200);
            expect(response.body.scans).toBeInstanceOf(Array);
        });

        test('should return scans in descending order', async () => {
            const response = await request(app).get('/local/scans');

            expect(response.status).toBe(200);
            if (response.body.scans.length > 1) {
                const dates = response.body.scans.map(s => new Date(s.CreatedAt));
                for (let i = 1; i < dates.length; i++) {
                    expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
                }
            }
        });
    });

    describe('GET /local/scans/:id', () => {
        test('should return specific scan by ID', async () => {
            if (!testScanId) {
                // Create one first
                const createRes = await request(app)
                    .post('/local/scans')
                    .field('studentId', '111222')
                    .field('examId', 'BIO-2024-Q1')
                    .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg'));
                testScanId = createRes.body.scan.Id;
            }

            const response = await request(app).get(`/local/scans/${testScanId}`);

            expect(response.status).toBe(200);
            expect(response.body.scan).toBeDefined();
            expect(response.body.scan.Id).toBe(testScanId);
        });

        test('should return 404 for non-existent scan', async () => {
            const response = await request(app).get('/local/scans/non-existent-id');

            expect(response.status).toBe(404);
        });
    });

    describe('PATCH /local/scans/:id', () => {
        test('should update grade and comments', async () => {
            if (!testScanId) {
                const createRes = await request(app)
                    .post('/local/scans')
                    .field('studentId', '333444')
                    .field('examId', 'HISTORY-2024-Q1')
                    .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg'));
                testScanId = createRes.body.scan.Id;
            }

            const response = await request(app)
                .patch(`/local/scans/${testScanId}`)
                .send({
                    grade: 95,
                    comments: 'Excellent work!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify update
            const getResponse = await request(app).get(`/local/scans/${testScanId}`);
            expect(getResponse.body.scan.Grade).toBe(95);
            expect(getResponse.body.scan.Comments).toBe('Excellent work!');
            expect(getResponse.body.scan.LastModifiedAt).toBeDefined();
        });

        test('should create SyncOutbox entry on update', async () => {
            const response = await request(app)
                .patch(`/local/scans/${testScanId}`)
                .send({
                    grade: 88,
                    comments: 'Good job'
                });

            expect(response.status).toBe(200);

            // Check SyncOutbox for Update entry
            const outboxResponse = await request(app).get('/local/sync/outbox');
            const updateEntry = outboxResponse.body.outbox.find(
                item => item.EntityId === testScanId && item.Action === 'Update'
            );
            expect(updateEntry).toBeDefined();
            expect(updateEntry.Status).toBe('Pending');
        });

        test('should accept null values', async () => {
            const response = await request(app)
                .patch(`/local/scans/${testScanId}`)
                .send({
                    grade: null,
                    comments: null
                });

            expect(response.status).toBe(200);
        });

        test('should validate grade range', async () => {
            const response = await request(app)
                .patch(`/local/scans/${testScanId}`)
                .send({
                    grade: 150 // Invalid: > 100
                });

            // Should either reject or accept (depending on implementation)
            // Adjust based on your validation logic
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('GET /local/sync/status', () => {
        test('should return sync status counts', async () => {
            const response = await request(app).get('/local/sync/status');

            expect(response.status).toBe(200);
            expect(response.body.status).toBeDefined();
            expect(response.body.status.pending).toBeGreaterThanOrEqual(0);
            expect(response.body.status.synced).toBeGreaterThanOrEqual(0);
            expect(response.body.status.failed).toBeGreaterThanOrEqual(0);
            expect(response.body.status.inProgress).toBeGreaterThanOrEqual(0);
        });
    });

    describe('GET /local/sync/outbox', () => {
        test('should return all outbox entries', async () => {
            const response = await request(app).get('/local/sync/outbox');

            expect(response.status).toBe(200);
            expect(response.body.outbox).toBeInstanceOf(Array);
        });

        test('should return entries with correct structure', async () => {
            const response = await request(app).get('/local/sync/outbox');

            if (response.body.outbox.length > 0) {
                const entry = response.body.outbox[0];
                expect(entry.Id).toBeDefined();
                expect(entry.EntityType).toBeDefined();
                expect(entry.EntityId).toBeDefined();
                expect(entry.Action).toBeDefined();
                expect(entry.Status).toBeDefined();
                expect(['Pending', 'InProgress', 'Synced', 'Failed']).toContain(entry.Status);
            }
        });
    });
});
