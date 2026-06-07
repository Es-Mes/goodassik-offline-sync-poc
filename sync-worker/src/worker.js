const {
    getPendingSyncEntries,
    updateSyncOutboxStatus,
    getScanById,
    updateScanSyncStatus,
    updateLocalScan,
    findPendingSyncEntryByEntityId,
    createLocalScan
} = require('./database/db');
const {
    checkCloudConnection,
    syncScanToCloud,
    fetchCloudUpdates,
    completeCloudUpdate,
    downloadScanFromCloud
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
                // Check if this is a DELETE action
                if (update.action === 'Delete') {
                    // Scan was deleted in cloud - delete it locally
                    const localScan = getScanById(update.entityid);

                    if (!localScan) {
                        console.log(`⚠️  Scan ${update.entityid} doesn't exist locally, skipping delete`);
                        await completeCloudUpdate(update.id, 'Skipped');
                        continue;
                    }

                    console.log(`🗑️  Deleting scan ${update.entityid} from local (synced from cloud)`);

                    try {
                        // Delete the scan from local database
                        const { deleteLocalScan } = require('./database/db');
                        deleteLocalScan(update.entityid);

                        console.log(`✅ Deleted scan ${update.entityid} from local database`);
                        await completeCloudUpdate(update.id, 'Synced');
                    } catch (error) {
                        console.error(`❌ Failed to delete scan ${update.entityid}:`, error.message);
                        await completeCloudUpdate(update.id, 'Failed');
                    }

                    continue;
                }

                // Check if this is a CREATE action
                if (update.action === 'Create') {
                    // This is a new scan created in cloud - pull it to local
                    const localScan = getScanById(update.entityid);

                    if (localScan) {
                        console.log(`⚠️  Scan ${update.entityid} already exists locally, skipping create`);
                        await completeCloudUpdate(update.id, 'Skipped');
                        continue;
                    }

                    console.log(`📥 Pulling new scan ${update.entityid} from cloud to local`);

                    try {
                        // Download compressed image from cloud
                        const scanData = await downloadScanFromCloud(update.entityid);
                        console.log(`✅ Downloaded image for scan ${update.entityid} to ${scanData.imagePath}`);

                        // Create the scan in local database using metadata from cloud
                        createLocalScan({
                            Id: update.entityid,
                            StudentId: scanData.studentId,
                            ExamId: scanData.examId,
                            ImagePath: scanData.imagePath,
                            Grade: scanData.grade,
                            Comments: scanData.comments,
                            LastModifiedAt: scanData.lastModifiedAt,
                            CreatedAt: scanData.createdAt
                        });

                        console.log(`✅ Created scan ${update.entityid} in local database`);
                        await completeCloudUpdate(update.id, 'Synced');
                    } catch (error) {
                        console.error(`❌ Failed to pull scan ${update.entityid}:`, error.message);
                        await completeCloudUpdate(update.id, 'Failed');
                    }

                    continue;
                }

                // Handle UPDATE actions
                const localScan = getScanById(update.entityid);

                if (!localScan) {
                    console.log(`⚠️  Local scan ${update.entityid} not found, skipping update`);
                    await completeCloudUpdate(update.id, 'Skipped');
                    continue;
                }

                // Check if we have a pending local change
                const hasPendingLocalChange = getPendingSyncEntries()
                    .some(entry => entry.EntityId === update.entityid);

                if (hasPendingLocalChange) {
                    // Conflict: Local has pending changes
                    console.log(`⚠️  Conflict detected for scan ${update.entityid} - local changes pending`);

                    // Get the local outbox entry to compare timestamps
                    const localEntry = findPendingSyncEntryByEntityId(update.entityid);

                    if (!localEntry) {
                        // No pending entry found, just apply cloud update
                        updateLocalScan(update.entityid, update.grade, update.comments, update.lastmodifiedat);
                        await completeCloudUpdate(update.id, 'Synced');
                        continue;
                    }

                    // Compare timestamps for conflict resolution:
                    // - cloudTime: when the cloud scan was last modified
                    // - localTime: when the local outbox entry was created (when local user made the change)
                    const cloudTime = new Date(update.lastmodifiedat).getTime();
                    const localTime = new Date(localEntry.CreatedAt).getTime();

                    console.log(`⏰ Timestamp comparison: cloud=${update.lastmodifiedat} (${cloudTime}), local outbox=${localEntry.CreatedAt} (${localTime})`);

                    if (cloudTime > localTime) {
                        // Cloud is newer - override local
                        console.log(`🔄 Cloud is newer, overriding local changes for ${update.entityid}`);
                        updateLocalScan(update.entityid, update.grade, update.comments, update.lastmodifiedat);

                        // Mark the local pending entry as Overridden
                        updateSyncOutboxStatus(localEntry.Id, 'Overridden');

                        await completeCloudUpdate(update.id, 'Overridden');
                    } else {
                        // Local is newer - skip cloud update
                        console.log(`⏭️  Local is newer, skipping cloud update for ${update.entityid}`);
                        await completeCloudUpdate(update.id, 'Skipped');
                    }
                } else {
                    // No conflict - check if cloud is newer
                    const cloudTime = new Date(update.lastmodifiedat).getTime();
                    const localTime = new Date(localScan.LastModifiedAt || localScan.CreatedAt).getTime();

                    if (cloudTime > localTime) {
                        // Cloud is newer - apply update
                        console.log(`✅ Applying cloud update for ${update.entityid}`);
                        updateLocalScan(update.entityid, update.grade, update.comments, update.lastmodifiedat);
                        await completeCloudUpdate(update.id, 'Synced');
                    } else {
                        // Local is same or newer - skip
                        console.log(`⏭️  Local is up-to-date, skipping ${update.entityid}`);
                        await completeCloudUpdate(update.id, 'Skipped');
                    }
                }

            } catch (error) {
                console.error(`❌ Failed to apply update ${update.id}:`, error.message);
                // Mark cloud update as Failed so it can be retried
                try {
                    await completeCloudUpdate(update.id, 'Failed');
                } catch (completeError) {
                    console.error(`❌ Failed to mark update ${update.id} as Failed:`, completeError.message);
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

                // For Delete actions, scan might not exist anymore - that's okay
                if (!scan && entry.Action !== 'Delete') {
                    throw new Error(`Scan ${entry.EntityId} not found`);
                }

                // For Delete actions, skip outdated checks
                if (entry.Action !== 'Delete' && scan) {
                    // Check if this outbox entry is outdated (created before scan's last modification)
                    const outboxCreatedTime = new Date(entry.CreatedAt).getTime();
                    const scanModifiedTime = new Date(scan.LastModifiedAt || scan.CreatedAt).getTime();

                    if (outboxCreatedTime < scanModifiedTime) {
                        // This entry is outdated - the scan was modified after this entry was created
                        console.log(`⏭️  Skipping outdated entry ${entry.Id} for scan ${entry.EntityId}`);
                        updateSyncOutboxStatus(entry.Id, 'Skipped');
                        continue;
                    }
                }

                // Update status to InProgress
                updateSyncOutboxStatus(entry.Id, 'InProgress');
                if (entry.Action !== 'Delete') {
                    updateScanSyncStatus(entry.EntityId, 'Syncing');
                }

                // Sync to cloud
                await syncScanToCloud(scan, entry);

                // Mark as synced
                updateSyncOutboxStatus(entry.Id, 'Synced');
                if (entry.Action !== 'Delete') {
                    updateScanSyncStatus(entry.EntityId, 'Synced');
                }

                console.log(`✅ Synced: ${entry.EntityId}`);

            } catch (error) {
                console.error(`❌ Failed to sync ${entry.EntityId}:`, error.message);

                // Check if this is a conflict (409)
                if (error.response && error.response.status === 409) {
                    console.log(`⚠️  Conflict detected for ${entry.EntityId} - cloud version is newer, marking as Overridden`);
                    updateSyncOutboxStatus(entry.Id, 'Overridden');

                    // Pull the cloud version
                    if (error.response.data && error.response.data.cloudScan) {
                        const cloudScan = error.response.data.cloudScan;
                        updateLocalScan(entry.EntityId, cloudScan.grade, cloudScan.comments, cloudScan.lastmodifiedat);
                        updateScanSyncStatus(entry.EntityId, 'Synced');
                        console.log(`✅ Local scan ${entry.EntityId} updated with cloud version`);
                    }
                    continue;
                }

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
