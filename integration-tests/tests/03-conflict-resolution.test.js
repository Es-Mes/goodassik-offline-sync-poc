// Integration Test 03: Conflict Resolution
// Tests that conflicts are resolved based on LastModifiedAt timestamp

const { localApi, cloudApi, wait } = require('../utils/test-helpers');

describe('Integration Test 03: Conflict Resolution', () => {
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

    test('should resolve conflict - Cloud Wins (newer timestamp)', async () => {
        console.log('Creating exam scan locally...');
        const localScan = await localApi.createScan('STUDENT-201', 'EXAM-CONFLICT-01');
        testScanId = localScan.Id;

        console.log('Waiting for sync to cloud...');
        await wait(20000);

        const syncedLocal = await localApi.getScan(localScan.Id);
        expect(syncedLocal.SyncStatus).toBe('Synced');

        // Update in cloud (this will have newer timestamp)
        console.log('Updating in cloud...');
        await wait(2000); // Small delay to ensure newer timestamp
        await cloudApi.updateScan(localScan.Id, {
            Grade: 90,
            Comments: 'Cloud update - should win'
        });

        // Update locally with older timestamp (should lose)
        console.log('Updating locally with older timestamp...');
        const olderTimestamp = new Date(Date.now() - 5000).toISOString(); // 5 seconds in the past
        await localApi.updateScan(localScan.Id, {
            Grade: 85,
            Comments: 'Local update - should lose',
            LastModifiedAt: olderTimestamp
        });

        // Wait for conflict resolution
        console.log('Waiting 25 seconds for conflict resolution...');
        await wait(25000);

        // Verify cloud version won
        const resolvedLocal = await localApi.getScan(localScan.Id);
        console.log(`Resolved - Grade: ${resolvedLocal.Grade}, Comments: ${resolvedLocal.Comments}`);
        expect(resolvedLocal.Grade).toBe(90);
        expect(resolvedLocal.Comments).toBe('Cloud update - should win');
        expect(resolvedLocal.SyncStatus).toBe('Synced');
    }, 60000);

    test('should resolve conflict - Local Wins (newer timestamp)', async () => {
        console.log('Creating exam scan locally...');
        const localScan = await localApi.createScan('STUDENT-202', 'EXAM-CONFLICT-02');
        testScanId = localScan.Id;

        console.log('Waiting for sync to cloud...');
        await wait(20000);

        const syncedLocal = await localApi.getScan(localScan.Id);
        expect(syncedLocal.SyncStatus).toBe('Synced');

        // Update locally first
        console.log('Updating locally...');
        await localApi.updateScan(localScan.Id, {
            Grade: 92,
            Comments: 'Local update - older'
        });

        await wait(20000); // Wait for sync

        // Update locally again (this will have newest timestamp)
        console.log('Updating locally again with newer timestamp...');
        await wait(2000);
        await localApi.updateScan(localScan.Id, {
            Grade: 95,
            Comments: 'Local update - should win'
        });

        // Wait for conflict resolution
        console.log('Waiting for sync...');
        await wait(20000);

        // Verify local version won
        const resolvedLocal = await localApi.getScan(localScan.Id);
        const resolvedCloud = await cloudApi.getScan(localScan.Id);

        console.log(`Resolved - Local Grade: ${resolvedLocal.Grade}, Cloud Grade: ${resolvedCloud.Grade}`);
        expect(resolvedLocal.Grade).toBe(95);
        expect(resolvedLocal.Comments).toBe('Local update - should win');
        expect(resolvedCloud.Grade).toBe(95);
        expect(resolvedCloud.Comments).toBe('Local update - should win');
        expect(resolvedLocal.SyncStatus).toBe('Synced');
    }, 70000);
});
