const request = require('supertest');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';

const app = require('../src/server');

describe('Cloud API - Sync', () => {
    let testScanId = null;

    beforeAll(() => {
        // Create test compressed file
        const testDir = path.join(__dirname, 'test-data');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        const testImagePath = path.join(testDir, 'test-scan.jpg.gz');
        fs.writeFileSync(testImagePath, Buffer.alloc(1024, 0xff));
    });

    afterAll(() => {
        const testDir = path.join(__dirname, 'test-data');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('POST /api/sync/scans', () => {
        test('should receive and save synced scan', async () => {
            const scanId = `test-scan-${Date.now()}`;
            const createdAt = new Date().toISOString();

            const response = await request(app)
                .post('/api/sync/scans')
                .field('scanId', scanId)
                .field('studentId', '123456')
                .field('examId', 'MATH-2024-Q1')
                .field('createdAt', createdAt)
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg.gz'));

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.scanId).toBe(scanId);

            testScanId = scanId;
        });

        test('should handle idempotency (duplicate scan)', async () => {
            const scanId = `duplicate-scan-${Date.now()}`;
            const createdAt = new Date().toISOString();

            // First upload
            await request(app)
                .post('/api/sync/scans')
                .field('scanId', scanId)
                .field('studentId', '789012')
                .field('examId', 'ENGLISH-2024-Q2')
                .field('createdAt', createdAt)
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg.gz'));

            // Second upload (duplicate)
            const response = await request(app)
                .post('/api/sync/scans')
                .field('scanId', scanId)
                .field('studentId', '789012')
                .field('examId', 'ENGLISH-2024-Q2')
                .field('createdAt', createdAt)
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg.gz'));

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('already');
        });

        test('should fail without required fields', async () => {
            const response = await request(app)
                .post('/api/sync/scans')
                .field('studentId', '123456')
                .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg.gz'));

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/sync/scans', () => {
        test('should return all synced scans', async () => {
            const response = await request(app).get('/api/sync/scans');

            expect(response.status).toBe(200);
            expect(response.body.scans).toBeInstanceOf(Array);
        });

        test('should return scans with correct structure', async () => {
            const response = await request(app).get('/api/sync/scans');

            if (response.body.scans.length > 0) {
                const scan = response.body.scans[0];
                expect(scan.id).toBeDefined();
                expect(scan.studentid).toBeDefined();
                expect(scan.examid).toBeDefined();
                expect(scan.createdat).toBeDefined();
            }
        });
    });

    describe('PATCH /api/sync/scans/:id', () => {
        test('should update grade and comments in cloud', async () => {
            if (!testScanId) {
                // Create a scan first
                testScanId = `patch-test-scan-${Date.now()}`;
                await request(app)
                    .post('/api/sync/scans')
                    .field('scanId', testScanId)
                    .field('studentId', '111222')
                    .field('examId', 'BIO-2024-Q1')
                    .field('createdAt', new Date().toISOString())
                    .attach('image', path.join(__dirname, 'test-data', 'test-scan.jpg.gz'));
            }

            const response = await request(app)
                .patch(`/api/sync/scans/${testScanId}`)
                .send({
                    grade: 95,
                    comments: 'Excellent from cloud!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should create CloudSyncOutbox entry on update', async () => {
            const response = await request(app)
                .patch(`/api/sync/scans/${testScanId}`)
                .send({
                    grade: 88,
                    comments: 'Updated again'
                });

            expect(response.status).toBe(200);

            // Check updates endpoint
            const updatesResponse = await request(app).get('/api/sync/updates');
            expect(updatesResponse.status).toBe(200);
            expect(updatesResponse.body.updates).toBeInstanceOf(Array);

            // Should have at least one pending update
            const hasPending = updatesResponse.body.updates.some(
                u => u.entityid === testScanId && u.status === 'Pending'
            );
            expect(hasPending).toBe(true);
        });

        test('should return 404 for non-existent scan', async () => {
            const response = await request(app)
                .patch('/api/sync/scans/non-existent-id')
                .send({
                    grade: 50
                });

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/sync/updates', () => {
        test('should return pending updates', async () => {
            const response = await request(app).get('/api/sync/updates');

            expect(response.status).toBe(200);
            expect(response.body.updates).toBeInstanceOf(Array);
        });

        test('should return updates with correct structure', async () => {
            const response = await request(app).get('/api/sync/updates');

            if (response.body.updates.length > 0) {
                const update = response.body.updates[0];
                expect(update.id).toBeDefined();
                expect(update.entityid).toBeDefined();
                expect(update.status).toBe('Pending');
                expect(update.grade).toBeDefined();
                expect(update.lastmodifiedat).toBeDefined();
            }
        });
    });

    describe('POST /api/sync/updates/:id/complete', () => {
        test('should mark update as Synced', async () => {
            // Get an update
            const updatesResponse = await request(app).get('/api/sync/updates');
            if (updatesResponse.body.updates.length === 0) {
                // Create one
                await request(app)
                    .patch(`/api/sync/scans/${testScanId}`)
                    .send({ grade: 77 });

                const newUpdatesResponse = await request(app).get('/api/sync/updates');
                expect(newUpdatesResponse.body.updates.length).toBeGreaterThan(0);
            }

            const updatesResponse2 = await request(app).get('/api/sync/updates');
            const updateId = updatesResponse2.body.updates[0].id;

            const response = await request(app)
                .post(`/api/sync/updates/${updateId}/complete`)
                .send({ status: 'Synced' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should accept Overridden status', async () => {
            // Create another update
            await request(app)
                .patch(`/api/sync/scans/${testScanId}`)
                .send({ grade: 66 });

            const updatesResponse = await request(app).get('/api/sync/updates');
            const updateId = updatesResponse.body.updates.find(u => u.status === 'Pending')?.id;

            if (updateId) {
                const response = await request(app)
                    .post(`/api/sync/updates/${updateId}/complete`)
                    .send({ status: 'Overridden' });

                expect(response.status).toBe(200);
            }
        });

        test('should accept Skipped status', async () => {
            // Create another update
            await request(app)
                .patch(`/api/sync/scans/${testScanId}`)
                .send({ grade: 55 });

            const updatesResponse = await request(app).get('/api/sync/updates');
            const updateId = updatesResponse.body.updates.find(u => u.status === 'Pending')?.id;

            if (updateId) {
                const response = await request(app)
                    .post(`/api/sync/updates/${updateId}/complete`)
                    .send({ status: 'Skipped' });

                expect(response.status).toBe(200);
            }
        });
    });
});
