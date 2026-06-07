// Integration Test 01: Push Sync (Local → Cloud)
// Tests that new scans created locally are pushed to the cloud

const { localApi, cloudApi, wait } = require('../utils/test-helpers');

describe('Integration Test 01: Push Sync (Local → Cloud)', () => {
    let testScanId;

    afterEach(async () => {
        // Cleanup
        if (testScanId) {
            try {
                // Note: DELETE not implemented yet, will be added later
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    });

    test('should sync new exam scan from Local to Cloud', async () => {
        console.log('Creating exam scan locally...');
        const scan = await localApi.createScan('STUDENT-001', 'EXAM-MATH-2026');
        testScanId = scan.Id;

        console.log(`Created scan ${scan.Id} with status: ${scan.SyncStatus}`);
        expect(scan.SyncStatus).toBe('Pending');
        expect(scan.StudentId).toBe('STUDENT-001');
        expect(scan.ExamId).toBe('EXAM-MATH-2026');

        // Wait for sync worker to process (5 second interval)
        console.log('Waiting 20 seconds for sync worker to push to cloud...');
        await wait(20000);

        // Verify status changed to Synced in local
        const updatedLocal = await localApi.getScan(scan.Id);
        console.log(`Local scan status after sync: ${updatedLocal.SyncStatus}`);
        expect(updatedLocal.SyncStatus).toBe('Synced');

        // Verify scan exists in cloud
        const cloudScan = await cloudApi.getScan(scan.Id);
        console.log(`Cloud scan retrieved: ${cloudScan.Id}`);
        expect(cloudScan.Id).toBe(scan.Id);
        expect(cloudScan.StudentId).toBe('STUDENT-001');
        expect(cloudScan.ExamId).toBe('EXAM-MATH-2026');
    }, 30000);

    test('should sync exam scan updates from Local to Cloud', async () => {
        console.log('Creating exam scan locally...');
        const scan = await localApi.createScan('STUDENT-002', 'EXAM-ENG-2026');
        testScanId = scan.Id;

        console.log('Waiting for initial sync...');
        await wait(20000);

        const syncedLocal = await localApi.getScan(scan.Id);
        expect(syncedLocal.SyncStatus).toBe('Synced');

        // Update the scan locally
        console.log('Updating scan with grade and comments...');
        await localApi.updateScan(scan.Id, {
            Grade: 95,
            Comments: 'Excellent work on exam'
        });

        const updatedLocal = await localApi.getScan(scan.Id);
        console.log(`Updated scan status: ${updatedLocal.SyncStatus}`);
        expect(updatedLocal.SyncStatus).toBe('Pending'); // Should be pending after update

        // Wait for sync worker to push update
        console.log('Waiting for update to sync to cloud...');
        await wait(25000); // Increased to 25 seconds for update sync

        // Verify update synced
        const reSyncedLocal = await localApi.getScan(scan.Id);
        expect(reSyncedLocal.SyncStatus).toBe('Synced');

        const cloudScan = await cloudApi.getScan(scan.Id);
        console.log(`Cloud scan grade: ${cloudScan.Grade}, comments: ${cloudScan.Comments}`);
        expect(cloudScan.Grade).toBe(95);
        expect(cloudScan.Comments).toBe('Excellent work on exam');
    }, 55000); // Increased timeout
});
