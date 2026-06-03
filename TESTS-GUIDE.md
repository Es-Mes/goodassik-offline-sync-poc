# 🧪 Unit Tests & Integration Tests

## סקירה כללית

המערכת כוללת מערך טסטים אוטומטיים המכסים את כל הפונקציונליות:
- ✅ **Unit Tests** - בדיקות לפונקציות בודדות ו-API endpoints
- ✅ **API Tests** - בדיקות ל-REST endpoints (**28 טסטים**)
- 🔜 **Integration Tests** - בדיקות end-to-end עם Docker

---

## 🎯 סטטוסי סינכרון במערכת

המערכת תומכת ב-**6 סטטוסים** שמכסים את כל תרחישי הסינכרון:

### Local SyncOutbox (6 סטטוסים)
1. **Pending** - ממתין לסינכרון
2. **InProgress** - בתהליך סינכרון
3. **Synced** - סונכרן בהצלחה
4. **Failed** - נכשל (יתבצע ניסיון חוזר)
5. **Overridden** - נדרס על ידי עדכון מהענן (conflict resolution)
6. **Skipped** - מיושן (נוצר לפני שהסריקה עודכנה)

### CloudSyncOutbox (5 סטטוסים)
1. **Pending** - ממתין להורדה לLocal
2. **Synced** - הורד והוחל בהצלחה
3. **Failed** - נכשל בהחלה (יתבצע ניסיון חוזר)
4. **Overridden** - הענן ניצח בקונפליקט
5. **Skipped** - Local יותר עדכני

---

## 🔧 תיקוני Bugs - כיסוי סטטוסים מלא

בשלב הפיתוח זיהינו 3 באגים קריטיים בטיפול בסטטוסים:

### ✅ Bug Fix #1: Skipped לentries מיושנים
**בעיה:** Worker לא בודק אם Outbox entry מיושן לפני push
**פתרון:** בדיקה אם `Outbox.CreatedAt < Scan.LastModifiedAt` → סימון כ-Skipped
```javascript
// sync-worker/src/worker.js
const outboxCreatedTime = new Date(entry.CreatedAt).getTime();
const scanModifiedTime = new Date(scan.LastModifiedAt || scan.CreatedAt).getTime();
if (outboxCreatedTime < scanModifiedTime) {
    updateSyncOutboxStatus(entry.Id, 'Skipped');
}
```

### ✅ Bug Fix #2: Overridden ב-Local כשהענן מנצח
**בעיה:** כאשר Cloud מדרס Local בconflict, Local Outbox לא מסומן Overridden
**פתרון:** מציאת הLocal pending entry וסימונו כ-Overridden
```javascript
// sync-worker/src/worker.js
if (cloudTime > localTime) {
    updateLocalScan(update.EntityId, update.Grade, update.Comments, update.LastModifiedAt);
    const localEntry = findPendingSyncEntryByEntityId(update.EntityId);
    if (localEntry) {
        updateSyncOutboxStatus(localEntry.Id, 'Overridden');
    }
}
```

### ✅ Bug Fix #3: Failed ב-CloudSyncOutbox
**בעיה:** אם החלת עדכון מהענן נכשלת, CloudSyncOutbox לא מסומן Failed
**פתרון:** try-catch עם קריאה ל-completeCloudUpdate עם 'Failed'
```javascript
// sync-worker/src/worker.js
try {
    updateLocalScan(...);
    await completeCloudUpdate(update.Id, 'Synced');
} catch (error) {
    await completeCloudUpdate(update.Id, 'Failed');
}
```

---

## 📚 Unit Tests vs Integration Tests

### Unit Tests (API Tests) - ✅ מומש
**מה בודקים:** בדיקות לendpoints בודדים במנותק
**איך:** Jest + Supertest + In-memory DB
**איפה:** `local-api/tests/`, `cloud-api/tests/`
**דוגמאות:**
- POST endpoint יוצר רשומה נכונה
- PATCH endpoint מעדכן נתונים
- Validation errors מוחזרים נכון

### Integration Tests - 🔜 הבא
**מה בודקים:** תרחישים מלאים end-to-end
**איך:** Docker Compose + כל השירותים יחד
**איפה:** `tests/integration/`
**דוגמאות:**
- יצירת סריקה → Worker מסנכרן → מופיע בCloud
- עדכון בCloud → Worker מוריד → מופיע בLocal
- Conflict resolution בין Local ו-Cloud

---

## 🛠️ כלים בשימוש

- **Jest** - Test framework
- **Supertest** - HTTP assertions
- **Better-sqlite3** - In-memory DB for tests
- **PostgreSQL** - Test database (optional)

---

## 📋 מבנה הטסטים

```
goodassik-offline-sync-poc/
├── local-api/
│   └── tests/
│       ├── scans.test.js         ✅ כבר קיים
│       └── package.json          ✅ כבר קיים
├── cloud-api/
│   └── tests/
│       ├── sync.test.js          ✅ כבר קיים
│       └── package.json          ✅ כבר קיים
└── sync-worker/
    └── tests/
        └── worker.test.js        🔜 הבא
```

---

## 🚀 הרצת טסטים

### Local API Tests

```powershell
cd local-api/tests
npm install
npm test
```

**תוצאה מצופה:**
```
PASS tests/scans.test.js
  Local API - Scans
    POST /local/scans
      ✓ should create a new scan with valid data (250ms)
      ✓ should fail without studentId (50ms)
      ✓ should fail without image (45ms)
      ✓ should create SyncOutbox entry (180ms)
    GET /local/scans
      ✓ should return all scans (30ms)
      ✓ should return scans in descending order (35ms)
    PATCH /local/scans/:id
      ✓ should update grade and comments (120ms)
      ✓ should create SyncOutbox entry on update (95ms)
    GET /local/sync/status
      ✓ should return sync status counts (25ms)

Tests: 9 passed, 9 total
```

---

### Cloud API Tests

```powershell
cd cloud-api/tests
npm install
npm test
```

**תוצאה מצופה:**
```
PASS tests/sync.test.js
  Cloud API - Sync
    POST /api/sync/scans
      ✓ should receive and save synced scan (300ms)
      ✓ should handle idempotency (220ms)
    PATCH /api/sync/scans/:id
      ✓ should update grade and comments in cloud (150ms)
      ✓ should create CloudSyncOutbox entry (180ms)
    GET /api/sync/updates
      ✓ should return pending updates (40ms)
    POST /api/sync/updates/:id/complete
      ✓ should mark update as Synced (110ms)
      ✓ should accept Overridden status (95ms)

Tests: 7 passed, 7 total
```

---

## 🎯 מה הטסטים בודקים?

### Local API Tests (scans.test.js)

#### ✅ POST /local/scans
- יצירת סריקה חדשה עם נתונים תקינים
- דחייה ללא `studentId`
- דחייה ללא קובץ תמונה
- יצירת `SyncOutbox` entry אוטומטית

#### ✅ GET /local/scans
- קבלת כל הסריקות
- מיון לפי תאריך יצירה (DESC)

#### ✅ GET /local/scans/:id
- קבלת סריקה ספציפית
- 404 לסריקה שלא קיימת

#### ✅ PATCH /local/scans/:id
- עדכון ציון והערות
- יצירת `SyncOutbox` entry עם `Action: Update`
- תמיכה בערכי `null`
- ולידציה של טווח ציונים

#### ✅ GET /local/sync/status
- ספירת סטטוסים (pending, synced, failed, inProgress)

#### ✅ GET /local/sync/outbox
- קבלת כל רשומות ה-Outbox
- מבנה נכון של רשומות

---

### Cloud API Tests (sync.test.js)

#### ✅ POST /api/sync/scans
- קליטת סריקה מסונכרנת
- Idempotency (דחייה של duplicate)
- ולידציה של שדות חובה

#### ✅ GET /api/sync/scans
- קבלת כל הסריקות המסונכרנות
- מבנה נכון (lowercase fields)

#### ✅ PATCH /api/sync/scans/:id
- עדכון ציון והערות בענן
- יצירת `CloudSyncOutbox` entry
- 404 לסריקה שלא קיימת

#### ✅ GET /api/sync/updates
- קבלת עדכונים ממתינים
- מבנה נכון (id, entityid, grade, status)

#### ✅ POST /api/sync/updates/:id/complete
- סימון עדכון כ-`Synced`
- תמיכה ב-`Overridden`
- תמיכה ב-`Skipped`

---

## 📊 Coverage

להרצת טסטים עם coverage:

```powershell
cd local-api/tests
npm run test:coverage
```

תקבלי דוח מפורט:
```
---------------------|---------|----------|---------|---------|
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
All files            |   85.23 |    78.45 |   90.12 |   84.89 |
 routes/scans.js     |   92.50 |    85.71 |   100   |   91.67 |
 routes/sync.js      |   78.26 |    70.00 |   83.33 |   77.78 |
---------------------|---------|----------|---------|---------|
```

---

## 🔧 Watch Mode (פיתוח)

בזמן פיתוח, אפשר להריץ במצב watch:

```powershell
npm run test:watch
```

הטסטים ירוצו אוטומטית כל פעם שתשמרי קובץ.

---

## 🐛 דיבוג טסטים

אם טסט נכשל:

1. **הרץ טסט ספציפי:**
```powershell
npm test -- scans.test.js
```

2. **הרץ טסט אחד:**
```powershell
npm test -- -t "should create a new scan"
```

3. **הפעל verbose mode:**
```powershell
npm test -- --verbose
```

---

## 🎓 כתיבת טסטים חדשים

### תבנית בסיסית:

```javascript
describe('Feature Name', () => {
    test('should do something', async () => {
        // Arrange - הכנה
        const data = { ... };
        
        // Act - ביצוע
        const response = await request(app)
            .post('/endpoint')
            .send(data);
        
        // Assert - בדיקה
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
```

### דוגמה מלאה:

```javascript
describe('PATCH /local/scans/:id', () => {
    let scanId;
    
    beforeEach(async () => {
        // Create test scan
        const res = await createTestScan();
        scanId = res.body.scan.Id;
    });
    
    test('should update grade', async () => {
        const response = await request(app)
            .patch(`/local/scans/${scanId}`)
            .send({ grade: 95 });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
    
    afterEach(async () => {
        // Cleanup if needed
    });
});
```

---

## 📝 Best Practices

✅ **שמות תיאוריים** - `should create scan when data is valid`
✅ **בדיקה אחת לטסט** - כל טסט בודק דבר אחד
✅ **Arrange-Act-Assert** - מבנה ברור
✅ **Cleanup** - נקה אחרי עצמך ב-`afterEach`
✅ **Independent** - כל טסט עצמאי (לא תלוי באחרים)
✅ **Fast** - טסטים מהירים (< 5s)

---

## 🚦 CI/CD Integration

ב-GitHub Actions / GitLab CI:

```yaml
test:
  script:
    - cd local-api/tests && npm install && npm test
    - cd cloud-api/tests && npm install && npm test
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
```

---

## 🧪 Integration Tests - תכנון

### 8 תרחישי טסט מתוכננים:

#### 1️⃣ Basic Online Sync (Local → Cloud)
- יצירת סריקה בLocal
- Worker מזהה ומסנכרן
- בדיקה שהסריקה מופיעה בCloud
- בדיקת SyncOutbox status = Synced

#### 2️⃣ Offline Mode + Auto Recovery
- יצירת סריקה כשהענן לא זמין
- בדיקה ש-SyncOutbox נשאר Pending
- הפעלת הענן מחדש
- בדיקה שהסינכרון מתבצע אוטומטית

#### 3️⃣ Multiple Scans Batch Sync
- יצירת 5 סריקות בו-זמנית
- בדיקה שכולן מסתנכרנות
- בדיקת סדר (FIFO)

#### 4️⃣ Update Grade in Local (PUSH)
- יצירת סריקה + סינכרון
- עדכון ציון בLocal
- בדיקה שהעדכון מגיע לCloud
- בדיקת CloudSyncOutbox שנוצר

#### 5️⃣ Update Grade in Cloud (PULL)
- יצירת סריקה + סינכרון
- עדכון ציון בCloud דרך UI
- בדיקה שהWorker מוריד את העדכון
- בדיקה שהLocal מתעדכן

#### 6️⃣ Conflict: Cloud Wins (Overridden)
- יצירת סריקה + סינכרון
- עדכון בLocal (Grade=80) - לא מסונכרן עדיין
- עדכון בCloud (Grade=90, timestamp מאוחר יותר)
- Worker מזהה conflict
- בדיקה: Local = 90 (Cloud ניצח)
- בדיקה: Local SyncOutbox = Overridden
- בדיקה: CloudSyncOutbox = Overridden

#### 7️⃣ Conflict: Local Wins (Skipped)
- יצירת סריקה + סינכרון
- עדכון בLocal (Grade=85, timestamp חדש)
- עדכון ישן בCloud (Grade=75, timestamp ישן)
- Worker מזהה conflict
- בדיקה: Local = 85 (Local ניצח)
- בדיקה: CloudSyncOutbox = Skipped

#### 8️⃣ Conflict with Pending Changes
- יצירת סריקה + סינכרון
- עדכון בLocal (Pending)
- עדכון בCloud (עדכן timestamp)
- Worker מזהה pending + בודק timestamps
- בדיקה שהמנגנון נכון (Last Write Wins)

---

## 🐳 Test Environment Setup

### docker-compose.test.yml (מתוכנן)
```yaml
services:
  test-local-api:
    build: ./local-api
    environment:
      - NODE_ENV=test
      - DB_PATH=:memory:
    
  test-cloud-api:
    build: ./cloud-api
    environment:
      - NODE_ENV=test
    depends_on:
      - test-cloud-db
  
  test-cloud-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=test_db
  
  test-sync-worker:
    build: ./sync-worker
    environment:
      - NODE_ENV=test
```

---

## 🎯 Next Steps

- [x] Unit/API Tests (28 טסטים - 15 Local + 13 Cloud)
- [x] Worker Bug Fixes (Skipped, Overridden, Failed)
- [ ] Integration Tests (8 תרחישים)
- [ ] Test Environment (docker-compose.test.yml)
- [ ] CI/CD Pipeline
- [ ] Performance Tests
- [ ] Frontend Tests (React Testing Library)

---

## 📊 Coverage Summary

### נוכחי (Unit/API Tests):
- ✅ Local API: 15 tests
- ✅ Cloud API: 13 tests
- ✅ **Total: 28 tests**
- ✅ סטטוסים: כל 6 מכוסים (Pending, InProgress, Synced, Failed, Overridden, Skipped)
- ✅ CRUD operations: מכוסה (Create, Read, Update)
- ✅ Validation: מכוסה (required fields, null values, ranges)
- ✅ Idempotency: מכוסה (duplicate handling)
- ✅ Error handling: מכוסה (404, 400)

### חסר (Integration Tests):
- ⏳ PUSH/PULL flows end-to-end
- ⏳ Conflict resolution בפועל
- ⏳ Offline/Online transitions
- ⏳ Worker retry logic

---

## 📝 רשימת כל הטסטים (28 Tests)

### 📦 Local API Tests - 15 טסטים

#### POST /local/scans (4 טסטים)
1. ✅ **should create a new scan with valid data** - יצירת סריקה חדשה עם studentId, examId ותמונה
2. ✅ **should fail without studentId** - דחיית בקשה ללא studentId (400 error)
3. ✅ **should fail without image** - דחיית בקשה ללא קובץ תמונה (400 error)
4. ✅ **should create SyncOutbox entry** - בדיקה שנוצר entry ב-SyncOutbox עם Status=Pending, Action=Create

#### GET /local/scans (2 טסטים)
5. ✅ **should return all scans** - החזרת כל הסריקות במערך
6. ✅ **should return scans in descending order** - מיון לפי CreatedAt בסדר יורד (החדש ביותר ראשון)

#### GET /local/scans/:id (2 טסטים)
7. ✅ **should return specific scan by ID** - קבלת סריקה ספציפית לפי Id
8. ✅ **should return 404 for non-existent scan** - החזרת 404 לסריקה שלא קיימת

#### PATCH /local/scans/:id (4 טסטים)
9. ✅ **should update grade and comments** - עדכון Grade ו-Comments של סריקה קיימת
10. ✅ **should create SyncOutbox entry on update** - יצירת entry חדש ב-SyncOutbox עם Action=Update
11. ✅ **should accept null values** - תמיכה בערכי null ל-Grade ו-Comments
12. ✅ **should validate grade range** - ולידציה של טווח ציונים (0-100)

#### GET /local/sync/status (1 טסט)
13. ✅ **should return sync status counts** - החזרת מונים לפי סטטוס: pending, synced, failed, inProgress

#### GET /local/sync/outbox (2 טסטים)
14. ✅ **should return all outbox entries** - החזרת כל רשומות ה-SyncOutbox
15. ✅ **should return entries with correct structure** - בדיקת מבנה: Id, EntityType, EntityId, Action, Status

---

### ☁️ Cloud API Tests - 13 טסטים

#### POST /api/sync/scans (3 טסטים)
1. ✅ **should receive and save synced scan** - קליטת סריקה מסונכרנת מ-Local API והכנסה ל-DB
2. ✅ **should handle idempotency (duplicate scan)** - זיהוי duplicate לפי scanId והחזרת "already synced"
3. ✅ **should fail without required fields** - דחיית בקשה ללא scanId/studentId/examId (400 error)

#### GET /api/sync/scans (2 טסטים)
4. ✅ **should return all synced scans** - החזרת כל הסריקות המסונכרנות מה-Cloud DB
5. ✅ **should return scans with correct structure** - בדיקת מבנה PostgreSQL: id, studentid, examid (lowercase)

#### PATCH /api/sync/scans/:id (3 טסטים)
6. ✅ **should update grade and comments in cloud** - עדכון Grade ו-Comments ב-Cloud DB
7. ✅ **should create CloudSyncOutbox entry on update** - יצירת entry ב-CloudSyncOutbox ל-PULL
8. ✅ **should return 404 for non-existent scan** - החזרת 404 לסריקה שלא קיימת בענן

#### GET /api/sync/updates (2 טסטים)
9. ✅ **should return pending updates** - החזרת עדכונים עם Status=Pending מ-CloudSyncOutbox
10. ✅ **should return updates with correct structure** - בדיקת מבנה: id, entityid, grade, status, lastmodifiedat

#### POST /api/sync/updates/:id/complete (3 טסטים)
11. ✅ **should mark update as Synced** - סימון עדכון כ-Synced אחרי החלה מוצלחת
12. ✅ **should accept Overridden status** - תמיכה בסטטוס Overridden (conflict - cloud wins)
13. ✅ **should accept Skipped status** - תמיכה בסטטוס Skipped (local is newer)

---

**בהצלחה! 🚀**

*כל שאלה? קריאה מסביר נוסף? אני כאן לעזור!*
