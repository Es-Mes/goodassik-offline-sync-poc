// Integration Test 04: Batch Sync
// Tests syncing multiple scans efficiently

const { localApi, cloudApi, wait } = require('../utils/test-helpers');

describe('Integration Test 04: Batch Sync', () => {
    const testScanIds = [];

    afterEach(async () => {
        // Cleanup
        for (const scanId of testScanIds) {
            try {
                // Note: DELETE not implemented yet, will be added later
            } catch (err) {
                // Ignore cleanup errors
            }
        }
        testScanIds.length = 0;
    });

    test('should sync multiple exam scans efficiently', async () => {
        console.log('Creating 10 exam scans locally...');
        const scans = [];
        const startTime = Date.now();

        for (let i = 1; i <= 10; i++) {
            const scan = await localApi.createScan(
                `STUDENT-${300 + i}`,
                `EXAM-BATCH-${i}`
            );
            scans.push(scan);
            testScanIds.push(scan.Id);
            console.log(`Created scan ${i}/10: ${scan.Id}`);
        }

        const createTime = Date.now() - startTime;
        console.log(`Created 10 scans in ${createTime}ms`);

        // All should be pending
        for (const scan of scans) {
            expect(scan.SyncStatus).toBe('Pending');
        }

        // Wait for sync worker to process all
        console.log('Waiting 30 seconds for batch sync...');
        await wait(30000);

        // Verify all synced
        let syncedCount = 0;
        for (const scan of scans) {
            const updated = await localApi.getScan(scan.Id);
            if (updated.SyncStatus === 'Synced') {
                syncedCount++;
            }

            // Also verify in cloud
            const cloudScan = await cloudApi.getScan(scan.Id);
            expect(cloudScan.StudentId).toBe(scan.StudentId);
            expect(cloudScan.ExamId).toBe(scan.ExamId);
        }

        console.log(`Synced ${syncedCount}/10 scans`);
        expect(syncedCount).toBe(10);
    }, 50000);

    test('should handle batch updates efficiently', async () => {
        console.log('Creating 5 exam scans...');
        const scans = [];

        for (let i = 1; i <= 5; i++) {
            const scan = await localApi.createScan(
                `STUDENT-${400 + i}`,
                `EXAM-BATCH-UPDATE-${i}`
            );
            scans.push(scan);
            testScanIds.push(scan.Id);
        }

        console.log('Waiting for initial sync...');
        await wait(20000);

        // Update all scans
        console.log('Updating all 5 scans...');
        for (let i = 0; i < scans.length; i++) {
            await localApi.updateScan(scans[i].Id, {
                Grade: 80 + i * 2,
                Comments: `Batch update test ${i + 1}`
            });
        }

        // Wait for updates to sync
        console.log('Waiting for batch updates to sync...');
        await wait(30000);

        // Verify all updates synced
        for (let i = 0; i < scans.length; i++) {
            const updated = await localApi.getScan(scans[i].Id);
            const cloudScan = await cloudApi.getScan(scans[i].Id);

            console.log(`Scan ${i + 1}: Local grade=${updated.Grade}, Cloud grade=${cloudScan.Grade}`);
            expect(updated.SyncStatus).toBe('Synced');
            expect(updated.Grade).toBe(80 + i * 2);
            expect(cloudScan.Grade).toBe(80 + i * 2);
        }
    }, 70000);
});
