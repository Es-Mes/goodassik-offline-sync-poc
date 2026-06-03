const {
    getPendingSyncEntries,
    updateSyncOutboxStatus,
    getScanById,
    updateScanSyncStatus,
    updateLocalScan,
    findPendingSyncEntryByEntityId
} = require('./database/db');
const {
    checkCloudConnection,
    syncScanToCloud,
    fetchCloudUpdates,
    completeCloudUpdate
} = require('./services/syncService');

const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 30000; // 30 seconds default
let isOnline = false;
let isSyncing = false;

async function pullCloudUpdates() {
    try {
        const updates = await fetchCloudUpdates();

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return;
        }

        console.log(`📥 Pulling ${updates.length} cloud updates...`);

        for (const update of updates) {
            try {
                // Get the local scan
                const localScan = getScanById(update.EntityId);

                if (!localScan) {
                    console.log(`⚠️  Local scan ${update.EntityId} not found, skipping update`);
                    await completeCloudUpdate(update.Id, 'Skipped');
                    continue;
                }

                // Check if we have a pending local change
                const hasPendingLocalChange = getPendingSyncEntries()
                    .some(entry => entry.EntityId === update.EntityId);

                if (hasPendingLocalChange) {
                    // Conflict: Local has pending changes
                    console.log(`⚠️  Conflict detected for scan ${update.EntityId} - local changes pending`);

                    // Compare timestamps for conflict resolution
                    const cloudTime = new Date(update.LastModifiedAt).getTime();
                    const localTime = new Date(localScan.LastModifiedAt || localScan.CreatedAt).getTime();

                    if (cloudTime > localTime) {
                        // Cloud is newer - override local
                        console.log(`🔄 Cloud is newer, overriding local changes for ${update.EntityId}`);
                        updateLocalScan(update.EntityId, update.Grade, update.Comments, update.LastModifiedAt);

                        // Mark the local pending entry as Overridden
                        const localEntry = findPendingSyncEntryByEntityId(update.EntityId);
                        if (localEntry) {
                            updateSyncOutboxStatus(localEntry.Id, 'Overridden');
                        }

                        await completeCloudUpdate(update.Id, 'Overridden');
                    } else {
                        // Local is newer - skip cloud update
                        console.log(`⏭️  Local is newer, skipping cloud update for ${update.EntityId}`);
                        await completeCloudUpdate(update.Id, 'Skipped');
                    }
                } else {
                    // No conflict - check if cloud is newer
                    const cloudTime = new Date(update.LastModifiedAt).getTime();
                    const localTime = new Date(localScan.LastModifiedAt || localScan.CreatedAt).getTime();

                    if (cloudTime > localTime) {
                        // Cloud is newer - apply update
                        console.log(`✅ Applying cloud update for ${update.EntityId}`);
                        updateLocalScan(update.EntityId, update.Grade, update.Comments, update.LastModifiedAt);
                        await completeCloudUpdate(update.Id, 'Synced');
                    } else {
                        // Local is same or newer - skip
                        console.log(`⏭️  Local is up-to-date, skipping ${update.EntityId}`);
                        await completeCloudUpdate(update.Id, 'Skipped');
                    }
                }

            } catch (error) {
                console.error(`❌ Failed to apply update ${update.Id}:`, error.message);
                // Mark cloud update as Failed so it can be retried
                try {
                    await completeCloudUpdate(update.Id, 'Failed');
                } catch (completeError) {
                    console.error(`❌ Failed to mark update ${update.Id} as Failed:`, completeError.message);
                }
            }
        }

        console.log('✨ Pull cycle completed');

    } catch (error) {
        console.error('Error pulling cloud updates:', error.message);
    }
}

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

        // PULL: Get updates from cloud first
        await pullCloudUpdates();

        // PUSH: Get pending entries
        const pendingEntries = getPendingSyncEntries();

        if (pendingEntries.length === 0) {
            return; // Nothing to sync
        }

        console.log(`📤 Syncing ${pendingEntries.length} pending items...`);

        for (const entry of pendingEntries) {
            try {
                // Get the scan data first to check if entry is outdated
                const scan = getScanById(entry.EntityId);

                if (!scan) {
                    throw new Error(`Scan ${entry.EntityId} not found`);
                }

                // Check if this outbox entry is outdated (created before scan's last modification)
                const outboxCreatedTime = new Date(entry.CreatedAt).getTime();
                const scanModifiedTime = new Date(scan.LastModifiedAt || scan.CreatedAt).getTime();

                if (outboxCreatedTime < scanModifiedTime) {
                    // This entry is outdated - the scan was modified after this entry was created
                    console.log(`⏭️  Skipping outdated entry ${entry.Id} for scan ${entry.EntityId}`);
                    updateSyncOutboxStatus(entry.Id, 'Skipped');
                    continue;
                }

                // Update status to InProgress
                updateSyncOutboxStatus(entry.Id, 'InProgress');
                updateScanSyncStatus(entry.EntityId, 'Syncing');

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
