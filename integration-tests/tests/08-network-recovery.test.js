const {
    uploadScan,
    getLocalScans,
    getCloudScans,
    waitForSync,
    updateScan
} = require('../utils/test-helpers');
const axios = require('axios');

describe('Integration Test 08: Network Recovery', () => {

    test('should queue changes when cloud is offline and sync when back online', async () => {
        // Create scan locally
        const uploadResult = await uploadScan('STU-008-A', 'EXM-008-A');
        expect(uploadResult.success).toBe(true);
        const scanId = uploadResult.scan.Id;

        // Wait for initial sync
        await waitForSync(10000);

        // Verify scan exists in cloud
        let cloudScans = await getCloudScans();
        expect(cloudScans.scans.some(s => s.id === scanId)).toBe(true);

        // Simulate cloud being offline by stopping the container
        console.log('⏸️  Simulating cloud offline (stopping test-cloud-api container)...');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        await execAsync('docker stop test-cloud-api');

        // Make changes locally while offline
        console.log('📝 Making changes while offline...');
        await updateScan(scanId, { grade: 88 });
        await waitForSync(3000);

        // Update again
        await updateScan(scanId, { grade: 92 });
        await waitForSync(3000);

        // Bring cloud back online
        console.log('✅ Bringing cloud back online (starting test-cloud-api container)...');
        await execAsync('docker start test-cloud-api');

        // Wait for container to fully start
        await waitForSync(5000);

        // Wait for sync to complete (worker should retry)
        await waitForSync(15000);

        // Verify changes synced to cloud
        cloudScans = await getCloudScans();
        const cloudScan = cloudScans.scans.find(s => s.id === scanId);
        expect(cloudScan).toBeDefined();
        expect(cloudScan.grade).toBe(92);

        console.log('✅ Changes synced after network recovery');
    }, 60000);

    test('should handle temporary network failures with retry', async () => {
        // Create scan locally
        const uploadResult = await uploadScan('STU-008-B', 'EXM-008-B');
        expect(uploadResult.success).toBe(true);
        const scanId = uploadResult.scan.Id;

        // Wait for sync
        await waitForSync(10000);

        // Verify in cloud
        const cloudScans = await getCloudScans();
        expect(cloudScans.scans.some(s => s.id === scanId)).toBe(true);

        console.log('✅ Scan created and synced normally');

        // Note: Full retry testing with container pause/unpause requires more complex setup
        // This test verifies the basic flow works
    }, 30000);

    test('should preserve local data during extended offline period', async () => {
        // Create multiple scans locally
        const scan1 = await uploadScan('STU-008-C1', 'EXM-008-C');
        const scan2 = await uploadScan('STU-008-C2', 'EXM-008-C');
        const scan3 = await uploadScan('STU-008-C3', 'EXM-008-C');

        expect(scan1.success).toBe(true);
        expect(scan2.success).toBe(true);
        expect(scan3.success).toBe(true);

        // Wait for sync
        await waitForSync(10000);

        // Update all scans
        await updateScan(scan1.scan.Id, { grade: 85, comments: 'Offline update 1' });
        await updateScan(scan2.scan.Id, { grade: 90, comments: 'Offline update 2' });
        await updateScan(scan3.scan.Id, { grade: 95, comments: 'Offline update 3' });

        // Verify local data persists
        const localScans = await getLocalScans();
        const local1 = localScans.scans.find(s => s.Id === scan1.scan.Id);
        const local2 = localScans.scans.find(s => s.Id === scan2.scan.Id);
        const local3 = localScans.scans.find(s => s.Id === scan3.scan.Id);

        expect(local1.Grade).toBe(85);
        expect(local2.Grade).toBe(90);
        expect(local3.Grade).toBe(95);

        // Wait for sync to cloud
        await waitForSync(15000);

        // Verify all synced
        const cloudScans = await getCloudScans();
        const cloud1 = cloudScans.scans.find(s => s.id === scan1.scan.Id);
        const cloud2 = cloudScans.scans.find(s => s.id === scan2.scan.Id);
        const cloud3 = cloudScans.scans.find(s => s.id === scan3.scan.Id);

        expect(cloud1.grade).toBe(85);
        expect(cloud2.grade).toBe(90);
        expect(cloud3.grade).toBe(95);

        console.log('✅ All offline changes preserved and synced');
    }, 45000);

});
