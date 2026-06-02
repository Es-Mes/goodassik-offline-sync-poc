const {
    getPendingSyncEntries,
    updateSyncOutboxStatus,
    getScanById,
    updateScanSyncStatus
} = require('./database/db');
const { checkCloudConnection, syncScanToCloud } = require('./services/syncService');

const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 30000; // 30 seconds default
let isOnline = false;
let isSyncing = false;

async function processSyncQueue() {
    if (isSyncing) {
        console.log('⏩ Sync already in progress, skipping...');
        return;
    }

    isSyncing = true;

    try {
        // Check cloud connection
        const cloudAvailable = await checkCloudConnection();

        if (!cloudAvailable && isOnline) {
            console.log('🔴 Cloud API is offline');
            isOnline = false;
        } else if (cloudAvailable && !isOnline) {
            console.log('🟢 Cloud API is online - starting sync');
            isOnline = true;
        }

        if (!cloudAvailable) {
            return; // Skip sync if offline
        }

        // Get pending entries
        const pendingEntries = getPendingSyncEntries();

        if (pendingEntries.length === 0) {
            return; // Nothing to sync
        }

        console.log(`📤 Syncing ${pendingEntries.length} pending items...`);

        for (const entry of pendingEntries) {
            try {
                // Update status to InProgress
                updateSyncOutboxStatus(entry.Id, 'InProgress');
                updateScanSyncStatus(entry.EntityId, 'Syncing');

                // Get the scan data
                const scan = getScanById(entry.EntityId);

                if (!scan) {
                    throw new Error(`Scan ${entry.EntityId} not found`);
                }

                // Sync to cloud
                await syncScanToCloud(scan, entry);

                // Mark as synced
                updateSyncOutboxStatus(entry.Id, 'Synced');
                updateScanSyncStatus(entry.EntityId, 'Synced');

                console.log(`✅ Synced: ${entry.EntityId}`);

            } catch (error) {
                console.error(`❌ Failed to sync ${entry.EntityId}:`, error.message);

                // Mark as failed
                updateSyncOutboxStatus(entry.Id, 'Failed', error.message);
                updateScanSyncStatus(entry.EntityId, 'Failed');

                // Continue with next entry instead of stopping
                continue;
            }
        }

        console.log('✨ Sync cycle completed');

    } catch (error) {
        console.error('Error in sync process:', error);
    } finally {
        isSyncing = false;
    }
}

async function startWorker() {
    console.log('🚀 Sync Worker started');
    console.log(`⏱️  Sync interval: ${SYNC_INTERVAL}ms (${SYNC_INTERVAL / 1000}s)`);

    // Wait 5 seconds before first sync to let services start up
    setTimeout(() => {
        // Run sync immediately
        processSyncQueue();

        // Then run on interval
        setInterval(processSyncQueue, SYNC_INTERVAL);
    }, 5000);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Start the worker
startWorker();
