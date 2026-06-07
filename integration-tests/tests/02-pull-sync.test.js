// Integration Test 02: Pull Sync (Cloud → Local)
// Tests that scans created in cloud are pulled to local

const { localApi, cloudApi, wait } = require('../utils/test-helpers');

describe('Integration Test 02: Pull Sync (Cloud → Local)', () => {
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

    test('should pull new exam scan from Cloud to Local', async () => {
        console.log('Creating exam scan in cloud...');
        const cloudScan = await cloudApi.createScan('STUDENT-101', 'EXAM-SCIENCE-2026');
        testScanId = cloudScan.Id;

        console.log(`Created cloud scan ${cloudScan.Id}`);
        expect(cloudScan.StudentId).toBe('STUDENT-101');
        expect(cloudScan.ExamId).toBe('EXAM-SCIENCE-2026');

        // Wait for sync worker to pull to local
        console.log('Waiting 20 seconds for sync worker to pull to local...');
        await wait(20000);

        // Verify scan exists in local
        const localScan = await localApi.getScan(cloudScan.Id);
        console.log(`Local scan retrieved: ${localScan.Id}, status: ${localScan.SyncStatus}`);
        expect(localScan.Id).toBe(cloudScan.Id);
        expect(localScan.StudentId).toBe('STUDENT-101');
        expect(localScan.ExamId).toBe('EXAM-SCIENCE-2026');
        expect(localScan.SyncStatus).toBe('Synced');
    }, 30000);

    test('should pull exam scan updates from Cloud to Local', async () => {
        console.log('Creating exam scan in cloud...');
        const cloudScan = await cloudApi.createScan('STUDENT-102', 'EXAM-HISTORY-2026');
        testScanId = cloudScan.Id;

        console.log('Waiting for initial pull...');
        await wait(20000);

        const localScan = await localApi.getScan(cloudScan.Id);
        expect(localScan.SyncStatus).toBe('Synced');

        // Update the scan in cloud
        console.log('Updating scan in cloud with grade...');
        await cloudApi.updateScan(cloudScan.Id, {
            Grade: 88,
            Comments: 'Good understanding of material'
        });

        // Wait for sync worker to pull update
        console.log('Waiting for update to pull to local...');
        await wait(20000);

        const updatedLocal = await localApi.getScan(cloudScan.Id);
        console.log(`Local scan grade: ${updatedLocal.Grade}, comments: ${updatedLocal.Comments}`);
        expect(updatedLocal.Grade).toBe(88);
        expect(updatedLocal.Comments).toBe('Good understanding of material');
        expect(updatedLocal.SyncStatus).toBe('Synced');
    }, 50000);
});
