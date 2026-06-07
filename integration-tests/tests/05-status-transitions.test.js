// Integration Test 05: Status Transitions
// Tests the SyncStatus state machine behavior

const { localApi, wait } = require('../utils/test-helpers');

describe('Integration Test 05: Status Transitions', () => {
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

    test('should transition from Pending to Synced', async () => {
        console.log('Creating exam scan...');
        const scan = await localApi.createScan('STUDENT-501', 'EXAM-STATUS-01');
        testScanId = scan.Id;

        console.log(`Initial status: ${scan.SyncStatus}`);
        expect(scan.SyncStatus).toBe('Pending');

        // Wait for sync
        console.log('Waiting for sync...');
        await wait(20000);

        const synced = await localApi.getScan(scan.Id);
        console.log(`After sync status: ${synced.SyncStatus}`);
        expect(synced.SyncStatus).toBe('Synced');
    }, 30000);

    test('should transition back to Pending after update, then to Synced', async () => {
        console.log('Creating exam scan...');
        const scan = await localApi.createScan('STUDENT-502', 'EXAM-STATUS-02');
        testScanId = scan.Id;

        console.log('Waiting for initial sync...');
        await wait(20000);

        const synced = await localApi.getScan(scan.Id);
        expect(synced.SyncStatus).toBe('Synced');

        // Update to trigger Pending state
        console.log('Updating scan...');
        await localApi.updateScan(scan.Id, {
            Grade: 87,
            Comments: 'Status transition test'
        });

        const afterUpdate = await localApi.getScan(scan.Id);
        console.log(`After update status: ${afterUpdate.SyncStatus}`);
        expect(afterUpdate.SyncStatus).toBe('Pending');

        // Wait for re-sync
        console.log('Waiting for re-sync...');
        await wait(20000);

        const reSynced = await localApi.getScan(scan.Id);
        console.log(`After re-sync status: ${reSynced.SyncStatus}`);
        expect(reSynced.SyncStatus).toBe('Synced');
    }, 50000);

    test('should handle multiple rapid updates', async () => {
        console.log('Creating exam scan...');
        const scan = await localApi.createScan('STUDENT-503', 'EXAM-STATUS-03');
        testScanId = scan.Id;

        console.log('Waiting for initial sync...');
        await wait(20000);

        // Multiple rapid updates
        console.log('Performing 3 rapid updates...');
        await localApi.updateScan(scan.Id, { Grade: 80, Comments: 'Update 1' });
        await wait(1000);
        await localApi.updateScan(scan.Id, { Grade: 85, Comments: 'Update 2' });
        await wait(1000);
        await localApi.updateScan(scan.Id, { Grade: 90, Comments: 'Update 3' });

        const afterUpdates = await localApi.getScan(scan.Id);
        console.log(`After updates status: ${afterUpdates.SyncStatus}`);
        expect(afterUpdates.SyncStatus).toBe('Pending');

        // Wait for final sync
        console.log('Waiting for final sync...');
        await wait(25000);

        const final = await localApi.getScan(scan.Id);
        console.log(`Final status: ${final.SyncStatus}, Grade: ${final.Grade}`);
        expect(final.SyncStatus).toBe('Synced');
        expect(final.Grade).toBe(90);
        expect(final.Comments).toBe('Update 3');
    }, 60000);
});
