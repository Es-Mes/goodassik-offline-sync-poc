# Integration Tests Setup and Execution

## Prerequisites

1. **Docker Desktop** running
2. **Node.js 18+** installed
3. All dependencies installed in each service

## Quick Start

### 🚀 **One-Click Test (Recommended)**

```powershell
# From project root - runs everything automatically
.\run-integration-tests.ps1
```

This automatically:
1. ✅ Starts Docker test environment
2. ✅ Installs dependencies (if needed)
3. ✅ Runs all integration tests
4. ✅ Saves log file with timestamp
5. ✅ Stops Docker environment when done

**Options:**
```powershell
# Keep Docker running after tests (for debugging)
.\run-integration-tests.ps1 -KeepRunning

# Skip Docker setup (if already running)
.\run-integration-tests.ps1 -SkipSetup
```

---

### ⚙️ **Manual Steps (Advanced)**

<details>
<summary>Click to expand manual testing steps</summary>

### 1. Start Test Environment

```powershell
# From project root
docker-compose -f docker-compose.test.yml up -d
```

This starts:
- PostgreSQL on port **5433** (test-cloud-db)
- Local API on port **3011**
- Cloud API on port **3012**
- Sync Worker with **5-second** sync interval

### 2. Install Test Dependencies

```powershell
cd integration-tests
npm install
```

### 3. Run Tests

```powershell
npm test
```

Or with watch mode:
```powershell
npm run test:watch
```

### 4. Stop Test Environment

```powershell
cd ..
docker-compose -f docker-compose.test.yml down
```

</details>

## Test Output

### 📺 **What You'll See in Terminal:**

```
🐳 Starting Docker test environment...
✅ Docker test environment ready

🧪 Running Integration Tests...
════════════════════════════════════════════════════════

 PASS  tests/01-push-sync.test.js (15.2s)
  Integration Test 1: Basic PUSH Sync
    ✓ should sync new scan from Local to Cloud (8234ms)
    Step 1: Creating scan in Local API...
    ✓ Scan created with ScanId: abc123
    Step 2: Checking SyncOutbox...
    ✓ SyncOutbox entry: Status=Pending, Operation=INSERT
    ...
    ✅ PUSH Sync Test PASSED

 PASS  tests/02-pull-sync.test.js (12.5s)
  Integration Test 2: Basic PULL Sync
    ✓ should sync Cloud update to Local (7891ms)
    ...

 PASS  tests/03-conflict-resolution.test.js (18.3s)
 PASS  tests/04-batch-sync.test.js (25.1s)
 PASS  tests/05-status-transitions.test.js (14.7s)
 PASS  tests/06-error-scenarios.test.js (22.4s)

Test Suites: 6 passed, 6 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        108.2 s

✅ ALL INTEGRATION TESTS PASSED!
Duration: 120.5 seconds
Log saved: test-results/integration-test-2026-06-05_14-23-45.log
```

### 📊 **What's Included:**
- ✅ Each test shows step-by-step progress (`Step 1: Creating scan...`)
- ✅ Real-time data (`ScanId: abc123`, `CloudScanId: xyz789`)
- ✅ Performance metrics (`Duration: 8234ms`, `Throughput: 2.5 scans/sec`)
- ✅ Status transitions (`Pending → InProgress → Synced`)
- ✅ Final summary with total time

### 📄 **Log Files:**
All output saved to:
```
test-results/integration-test-YYYY-MM-DD_HH-mm-ss.log
```

You can review later:
```powershell
Get-Content test-results\integration-test-*.log | Select-Object -Last 50
```

---

## Test Structure

```
integration-tests/
├── utils/
│   └── test-helpers.js       # Utilities for API calls, DB queries, waiting
├── tests/
│   ├── 01-push-sync.test.js           # Local → Cloud sync
│   ├── 02-pull-sync.test.js           # Cloud → Local sync
│   └── 03-conflict-resolution.test.js # Conflict scenarios
└── package.json
```

## Test Scenarios

### Test 1: PUSH Sync (Local → Cloud)
- Create scan in Local API
- Verify SyncOutbox entry (Pending)
- Wait for Worker (5-10 seconds)
- Verify scan in Cloud PostgreSQL
- Verify SyncOutbox status (Synced)
- Verify CloudScanId populated
- Test UPDATE operations

### Test 2: PULL Sync (Cloud → Local)
- Update scan in Cloud API
- Verify CloudSyncOutbox entry (Pending)
- Wait for Worker
- Verify Local scan updated
- Verify CloudSyncOutbox status (Synced)
- Test multiple Cloud updates

### Test 3: Conflict Resolution
- **Cloud Wins**: Cloud has newer timestamp → Local accepts Cloud's value
- **Local Wins**: Local has newer timestamp → Cloud updated, CloudSyncOutbox marked "Overridden"
- **Simultaneous**: Same timestamp → System handles gracefully

### Test 4: Batch Sync ⭐ NEW
- **Batch Creation**: Create 10 scans rapidly → Verify all sync correctly
- **Batch Updates**: Update 5 scans → Verify all updates sync
- **Order Preservation**: Verify sync maintains chronological order
- **Performance Metrics**: Measure throughput (scans/second)

### Test 5: Status Transitions ⭐ NEW
- **Full Lifecycle**: Pending → InProgress → Synced with timing verification
- **Skipped Status**: Outdated Local update vs newer Cloud update
- **Attempt Tracking**: Verify AttemptCount and LastAttemptAt updates
- **Timestamp Updates**: Verify LastModifiedAt changes on status transitions

### Test 6: Error Scenarios ⭐ NEW
- **Cloud Offline**: Handle Cloud API unreachable (manual test)
- **Retry Mechanism**: Verify retry logic and attempt counting
- **Data Validation**: Test malformed data (long barcodes, negative quantities)
- **Network Timeout**: Handle slow/timeout scenarios gracefully
- **Error Tracking**: Verify error messages recorded (if schema supports)

## Helper Functions

### API Calls
```javascript
const { localApi, cloudApi } = require('../utils/test-helpers');

// Local API
await localApi.createScan('BARCODE123', 10);
await localApi.updateScan(scanId, { Grade: 'A' });
const scan = await localApi.getScan(scanId);

// Cloud API
await cloudApi.updateScan(cloudScanId, { Comments: 'Updated' });
const scan = await cloudApi.getScan(cloudScanId);
```

### Database Queries
```javascript
const { dbHelpers } = require('../utils/test-helpers');

// Check data existence
const cloudScan = await dbHelpers.scanExistsInCloud(cloudScanId);
const localScan = dbHelpers.scanExistsInLocal(scanId);

// Check outbox status
const outbox = localApi.getOutboxStatus(scanId);
const cloudOutbox = await dbHelpers.getCloudOutboxStatus(cloudScanId);

// Cleanup
dbHelpers.cleanupLocal(scanId);
await dbHelpers.cleanupCloud(cloudScanId);
```

### Waiting for Sync
```javascript
const { scenarios } = require('../utils/test-helpers');

// Wait for PUSH sync (Local → Cloud)
await scenarios.waitForPushSync(scanId, 15000);

// Wait for PULL sync (Cloud → Local)
await scenarios.waitForPullSync(scanId, 'A+', 'Grade', 15000);
```

## Troubleshooting

### Tests Timeout
- Ensure Docker containers are running: `docker ps`
- Check Worker logs: `docker logs test-sync-worker`
- Increase timeout in test (default 30 seconds)

### Database Connection Errors
- Verify PostgreSQL is ready: `docker logs test-cloud-db`
- Check port 5433 not in use: `netstat -an | findstr 5433`
- Restart test environment: `docker-compose -f docker-compose.test.yml restart`

### API Connection Errors
- Verify APIs are running:
  - Local API: http://localhost:3011/health
  - Cloud API: http://localhost:3012/health
- Check API logs:
  - `docker logs test-local-api`
  - `docker logs test-cloud-api`

### Cleanup After Failed Tests
```powershell
# Stop all test containers
docker-compose -f docker-compose.test.yml down

# Remove volumes (fresh start)
docker-compose -f docker-compose.test.yml down -v

# Start fresh
docker-compose -f docker-compose.test.yml up -d
```

## Test Configuration

### Timeouts
- Jest default: **30 seconds** per test
- Sync wait: **15 seconds** max
- Sync interval: **5 seconds** (test env)

### Ports
- PostgreSQL: **5433** (production: 5432)
- Local API: **3011** (production: 3001)
- Cloud API: **3012** (production: 3002)

### Database Paths
- Local SQLite: `C:\Users\PC\Desktop\Good Assik\goodassik-offline-sync-poc\local-api\local-db\scans.db`
- Cloud PostgreSQL: `postgresql://clouduser:cloudpass123@localhost:5433/clouddb`

## Next Steps

### ✅ **After All Tests Pass:**

1. **Verify System Feasibility** ✅
   - All 17 integration tests passing = System works end-to-end
   - Batch sync performs well
   - Conflict resolution working correctly

2. **Add DELETE Operations** (Future Enhancement)
   - Once integration tests stable, add:
     - `DELETE /local/scans/:id` endpoint
     - SyncOutbox entry with Operation='DELETE'
     - Sync Worker DELETE handling
     - Integration test for DELETE sync
   
3. **Production Deployment**
   - Run production environment: `docker-compose up -d`
   - Test manually with frontend UI
   - Monitor sync logs for issues

4. **Performance Optimization** (Optional)
   - Review batch sync metrics
   - Optimize sync interval based on load
   - Add indexes if needed

---

## Notes

- Tests run **sequentially** (`--runInBand`) to avoid conflicts
- Each test cleans up its data in `afterEach`
- Console logs show detailed progress for debugging
- Test environment is **isolated** from production (different ports/databases)
- **DELETE operations**: Not yet implemented - will add after verifying current tests
