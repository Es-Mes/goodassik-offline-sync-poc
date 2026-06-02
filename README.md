# � Offline-First Bi-Directional Sync POC

## סקירה כללית

פרויקט POC (Proof of Concept) המדגים מערכת **offline-first** עם **סנכרון דו-כיווני** לניהול סריקות מבחנים.

### תכונות עיקריות:
- ✅ **סנכרון דו-כיווני** - עדכונים זורמים בשני הכיוונים (Local ⇄ Cloud)
- ✅ **Conflict Resolution** - פתרון קונפליקטים אוטומטי מבוסס timestamps
- ✅ **אונליין/אופליין** - פעולה מלאה ללא תלות בחיבור לענן
- ✅ **Real-time Updates** - ממשק משתמש עם רענון אוטומטי כל 5 שניות
- ✅ **GZIP Compression** - דחיסה של קבצים (60-70% חיסכון ב-bandwidth)
- ✅ **Grade & Comments** - ניהול ציונים והערות עם sync מלא

## 🏗️ ארכיטקטורה - Bi-Directional Sync

```
┌─────────────────────────────────────────────────────────────┐
│                      Local Environment                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────┐   │
│  │ Frontend │─────►│  Local API   │      │ Sync Worker │   │
│  │ (React)  │  ⬆️  │  (Node.js)   │◄────►│  (Node.js)  │   │
│  │Side-by-  │  ⬇️  │              │      │   PULL &    │   │
│  │  Side    │      │   SQLite     │      │   PUSH      │   │
│  └──────────┘      └──────────────┘      └─────────────┘   │
│                           │                      │           │
│                           ▼                      │           │
│                  ┌─────────────────┐             │           │
│                  │  ExamScans      │             │           │
│                  │  - Grade        │             │           │
│                  │  - Comments     │             │           │
│                  │  - LastModified │             │           │
│                  └─────────────────┘             │           │
│                  ┌─────────────────┐             │           │
│                  │  SyncOutbox     │             │           │
│                  │  (Push Queue)   │◄────────────┘           │
│                  └─────────────────┘                         │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                         📤 PUSH (Local→Cloud)
                         📥 PULL (Cloud→Local)
                         🔄 Conflict Resolution
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Environment                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    ┌──────────────┐                          │
│                    │  Cloud API   │                          │
│                    │  (Node.js)   │                          │
│                    │  PostgreSQL  │                          │
│                    └──────────────┘                          │
│                           │                                   │
│         ┌─────────────────┴─────────────────┐                │
│         │                                   │                │
│         ▼                                   ▼                │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │  ExamScans      │              │CloudSyncOutbox  │       │
│  │  - Grade        │              │ (Pull Queue)    │       │
│  │  - Comments     │              │                 │       │
│  │  - LastModified │              └─────────────────┘       │
│  └─────────────────┘                                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### תהליך הסנכרון הדו-כיווני:

**1. PUSH (Local → Cloud):**
- עדכון מקומי → `SyncOutbox` (Pending)
- Sync Worker שולח לענן ← GZIP compression
- בענן: שמירה ב-`ExamScans`
- עדכון סטטוס: `Synced`

**2. PULL (Cloud → Local):**
- עדכון בענן → `CloudSyncOutbox` (Pending)
- Sync Worker מושך מהענן
- **Conflict Resolution** - השוואת `LastModifiedAt`
- עדכון מקומי + סטטוס: `Synced` / `Overridden` / `Skipped`

**3. Conflict Resolution:**
```
IF cloud.LastModifiedAt > local.LastModifiedAt:
    → Apply cloud update (Status: Synced/Overridden)
ELSE:
    → Keep local version (Status: Skipped)
```
│  ┌──────────┐                      ┌─────────────┐          │
│  │PostgreSQL│                      │Cloud Storage│          │
│  │    DB    │                      │   (Files)   │          │
│  └──────────┘                      └─────────────┘          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 📁 מבנה תיקיות

```
goodassik-offline-sync-poc/
│
├── docker-compose.yml          # תצורת Docker לכל השירותים
├── README.md                   # המדריך הזה
├── .gitignore
├── .dockerignore
│
├── local-api/                  # API מקומי
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── database/
│   │   │   └── db.js           # SQLite configuration
│   │   ├── routes/
│   │   │   ├── scans.js        # POST /local/scans
│   │   │   └── sync.js         # GET /local/sync/*
│   │   └── services/
│   │       └── syncService.js
│   └── data/
│       └── local.db            # SQLite database (auto-created)
│
├── sync-worker/                # Worker לסנכרון
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── worker.js           # Main sync loop
│       ├── database/
│       │   └── db.js
│       └── services/
│           └── syncService.js  # Compression & upload
│
├── cloud-api/                  # API ענן
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── database/
│       │   └── db.js           # PostgreSQL configuration
│       └── routes/
│           └── sync.js         # POST /api/sync/scans
│
├── frontend/                   # React UI
│   ├── Dockerfile
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js              # Main component
│       ├── App.css
│       ├── index.js
│       └── index.css
│
├── local-storage/              # אחסון קבצים מקומי
│   └── scans/
│
└── cloud-storage/              # אחסון קבצים ענן
    └── scans/
```

## 🔧 טכנולוגיות

### Backend
- **Node.js** + **Express** - שרתי API
- **SQLite** - מסד נתונים מקומי (embedded)
- **PostgreSQL** - מסד נתונים ענן
- **better-sqlite3** - SQLite driver
- **pg** - PostgreSQL driver
- **multer** - העלאת קבצים
- **axios** - HTTP client
- **zlib** - דחיסת GZIP

### Frontend
- **React** - ממשק משתמש
- **axios** - קריאות API

### Infrastructure
- **Docker** + **Docker Compose** - קונטיינריזציה

## 🚀 התקנה והפעלה

### דרישות מקדימות
- Docker Desktop
- Node.js 18+ (אופציונלי, לפיתוח מחוץ לדוקר)

### שלב 1: הורדת הפרויקט
```bash
cd goodassik-offline-sync-poc
```

### שלב 2: הרמת כל השירותים

**⚠️ חשוב לפני העלאה ראשונה:**
```bash
# מחיקת volumes ישנים (אם קיימים)
docker-compose down -v

# בנייה והעלאה מחדש
docker-compose up --build
```

השירותים יעלו על הפורטים הבאים:
- **Frontend**: http://localhost:3000
- **Local API**: http://localhost:3001
- **Cloud API**: http://localhost:3002
- **PostgreSQL**: localhost:5432

### שלב 3: בדיקת הפעלה
פתח דפדפן וגש ל: http://localhost:3000

תראה ממשק עם:
- 💻 **Local Panel** - סריקות מקומיות
- ☁️ **Cloud Panel** - סריקות בענן
- 📊 **Sync Status** - מצב סנכרון בזמן אמת

## 📋 שימוש במערכת

### 1. העלאת סריקה חדשה

דרך הממשק (Frontend):
1. הזן מזהה תלמיד (לדוגמה: 123456)
2. הזן מזהה מבחן (לדוגמה: MATH-2024-Q1)
3. בחר קובץ תמונה
4. לחץ "שמור סריקה"

הסריקה תישמר מיידית ב-Local ותסתנכרן אוטומטית ל-Cloud תוך 30 שניות.

### 2. עדכון ציון והערות

**מ-Local:**
1. לחץ "ערוך" על כרטיס הסריקה ב-Local Panel
2. הזן ציון (0-100) והערות
3. לחץ "שמור"
4. העדכון יסתנכרן ל-Cloud תוך 30 שניות

**מ-Cloud:**
1. לחץ "ערוך" על כרטיס הסריקה ב-Cloud Panel
2. הזן ציון והערות
3. לחץ "שמור"
4. העדכון יורד ל-Local תוך 30 שניות

### 3. זיהוי קונפליקטים

כרטיסי סריקה מסומנים ב-⚠️ "קונפליקט" כאשר:
- Grade או Comments שונים בין Local ל-Cloud
- הסנכרון הבא יפתור את הקונפליקט לפי `LastModifiedAt`

### 4. מעקב אחר סטטוס סנכרון

הממשק מציג בזמן אמת:
- **ממתין** - עדכונים שממתינים לסנכרון
- **מסתנכרן** - עדכונים בתהליך
- **סונכרן** - הושלמו בהצלחה
- **נכשל** - נכשלו (ינסו שוב)

### 5. דימוי מצב אופליין

להפעלת מצב אופליין (ללא חיבור לענן):
```bash
docker stop cloud-api
```

כעת:
- סריקות חדשות נשמרות מקומית
- עדכונים נשארים ב-"Pending"
- Cloud Panel יציג "אין סריקות / ענן לא זמין"

להחזרת החיבור:
```bash
docker start cloud-api
```

תוך 30 שניות הסנכרון יחזור והכל יתעדכן אוטומטית! 🚀

## 🔍 API Endpoints

### Local API (http://localhost:3001)

#### POST /local/scans
העלאת סריקה חדשה
```bash
curl -X POST http://localhost:3001/local/scans \
  -F "studentId=123456" \
  -F "examId=MATH-2024-Q1" \
  -F "image=@test-scan.jpg"
```

**Response:**
```json
{
  "success": true,
  "scan": {
    "id": "uuid",
    "studentId": "123456",
    "examId": "MATH-2024-Q1",
    "imagePath": "/storage/scans/...",
    "createdAt": "2026-06-01T...",
    "syncStatus": "Pending"
  }
}
```

#### GET /local/scans
קבלת כל הסריקות
```bash
curl http://localhost:3001/local/scans
```

#### PATCH /local/scans/:id
עדכון ציון והערות (יוצר SyncOutbox entry)
```bash
curl -X PATCH http://localhost:3001/local/scans/SCAN_UUID \
  -H "Content-Type: application/json" \
  -d '{"grade": 95, "comments": "Excellent work!"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Scan updated successfully"
}
```

#### GET /local/sync/status
סטטוס סנכרון
```bash
curl http://localhost:3001/local/sync/status
```

**Response:**
```json
{
  "status": {
    "pending": 3,
    "synced": 15,
    "failed": 0,
    "inProgress": 1
  }
}
```

#### GET /local/sync/outbox
רשימת פריטים בתור סנכרון
```bash
curl http://localhost:3001/local/sync/outbox
```

### Cloud API (http://localhost:3002)

#### POST /api/sync/scans
קליטת סריקה מסונכרנת (משמש את ה-Sync Worker)
```bash
curl -X POST http://localhost:3002/api/sync/scans \
  -F "scanId=uuid" \
  -F "studentId=123456" \
  -F "examId=MATH-2024-Q1" \
  -F "createdAt=2026-06-01T..." \
  -F "image=@scan.jpg.gz"
```

#### GET /api/sync/scans
קבלת כל הסריקות המסונכרנות
```bash
curl http://localhost:3002/api/sync/scans
```

#### PATCH /api/sync/scans/:id
עדכון ציון והערות בענן (יוצר CloudSyncOutbox entry)
```bash
curl -X PATCH http://localhost:3002/api/sync/scans/SCAN_UUID \
  -H "Content-Type: application/json" \
  -d '{"grade": 88, "comments": "Good job"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Scan updated and queued for sync"
}
```

#### GET /api/sync/updates
קבלת עדכונים ממתינים מהענן (משמש את ה-Sync Worker)
```bash
curl http://localhost:3002/api/sync/updates
```

**Response:**
```json
[
  {
    "Id": "update-uuid",
    "EntityId": "scan-uuid",
    "Grade": 95,
    "Comments": "Excellent!",
    "LastModifiedAt": "2026-06-02T10:30:00Z",
    "Status": "Pending"
  }
]
```

#### POST /api/sync/updates/:id/complete
סימון עדכון כהושלם (משמש את ה-Sync Worker)
```bash
curl -X POST http://localhost:3002/api/sync/updates/UPDATE_UUID/complete \
  -H "Content-Type: application/json" \
  -d '{"status": "Synced"}'
```

**אפשרויות Status:**
- `Synced` - עדכון הוחל בהצלחה
- `Overridden` - הוחל למרות שהיה conflict (cloud newer)
- `Skipped` - דולג (local newer or not found)

## 🗄️ מבנה מסדי נתונים

### Local DB (SQLite)

**ExamScans**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | TEXT | מזהה ייחודי (UUID) |
| StudentId | TEXT | מזהה תלמיד |
| ExamId | TEXT | מזהה מבחן |
| ImagePath | TEXT | נתיב לקובץ |
| Grade | INTEGER | ציון (0-100) ⭐ חדש |
| Comments | TEXT | הערות על הסריקה ⭐ חדש |
| LastModifiedAt | TEXT | תאריך עדכון אחרון ⭐ חדש |
| CreatedAt | TEXT | תאריך יצירה (ISO) |
| SyncStatus | TEXT | Pending/Syncing/Synced/Failed |

**SyncOutbox** (Push Queue)
| שדה | סוג | תיאור |
|------|------|--------|
| Id | TEXT | מזהה ייחודי |
| EntityType | TEXT | סוג הישות (ExamScan) |
| EntityId | TEXT | מזהה הישות |
| Action | TEXT | Create/Update/Delete |
| Status | TEXT | Pending/InProgress/Synced/Failed/Overridden/Skipped ⭐ |
| RetryCount | INTEGER | מספר ניסיונות חוזרים |
| LastError | TEXT | הודעת שגיאה אחרונה |
| CreatedAt | TEXT | תאריך יצירה |
| SyncedAt | TEXT | תאריך סנכרון |

### Cloud DB (PostgreSQL)

**ExamScans**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | UUID | מזהה ייחודי |
| StudentId | TEXT | מזהה תלמיד |
| ExamId | TEXT | מזהה מבחן |
| ImagePath | TEXT | נתיב לקובץ |
| Grade | INTEGER | ציון (0-100) ⭐ חדש |
| Comments | TEXT | הערות על הסריקה ⭐ חדש |
| LastModifiedAt | TIMESTAMP | תאריך עדכון אחרון ⭐ חדש |
| CreatedAt | TIMESTAMP | תאריך יצירה |

**CloudSyncOutbox** (Pull Queue) ⭐ טבלה חדשה
| שדה | סוג | תיאור |
|------|------|--------|
| Id | UUID | מזהה ייחודי |
| EntityType | TEXT | סוג הישות (ExamScan) |
| EntityId | UUID | מזהה הסריקה |
| Action | TEXT | Update/Delete |
| Status | TEXT | Pending/Synced/Overridden/Skipped |
| Grade | INTEGER | הציון המעודכן |
| Comments | TEXT | ההערות המעודכנות |
| LastModifiedAt | TIMESTAMP | תאריך העדכון |
| RetryCount | INTEGER | מספר ניסיונות |
| LastError | TEXT | הודעת שגיאה |
| CreatedAt | TIMESTAMP | תאריך יצירת העדכון |
| SyncedAt | TIMESTAMP | תאריך השלמת הסנכרון |

**ExamScans**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | VARCHAR(255) | מזהה ייחודי |
| StudentId | VARCHAR(255) | מזהה תלמיד |
| ExamId | VARCHAR(255) | מזהה מבחן |
| ImagePath | TEXT | נתיב לקובץ |
| CreatedAt | TIMESTAMP | תאריך יצירה |
| SyncedAt | TIMESTAMP | תאריך סנכרון |

## 🔄 תהליך הסנכרון הדו-כיווני

### PUSH Flow (Local → Cloud):

1. **שמירה מקומית**
   - משתמש מעלה סריקה / מעדכן ציון דרך Frontend
   - Local API שומר ב-SQLite + Local Storage
   - נוצרת רשומה ב-`SyncOutbox` עם סטטוס "Pending"

2. **Sync Worker - PUSH**
   - כל 30 שניות בודק אם Cloud API זמין
   - מחפש רשומות Pending ב-`SyncOutbox`
   
3. **העברת קובץ/עדכון**
   - **Create**: דחיסת קובץ ב-GZIP → POST לענן
   - **Update**: שליחת Grade/Comments → PATCH לענן
   - מחיקת קבצים זמניים

4. **עדכון סטטוס**
   - הצלחה: `Synced`
   - כשלון: `Failed`, RetryCount++

---

### PULL Flow (Cloud → Local):

1. **עדכון בענן**
   - מישהו מעדכן ציון/הערות ב-Cloud API
   - נוצרת רשומה ב-`CloudSyncOutbox` עם סטטוס "Pending"

2. **Sync Worker - PULL** 
   - בכל סבב: `GET /api/sync/updates`
   - מקבל רשימת עדכונים ממתינים

3. **Conflict Resolution**
   ```
   עבור כל עדכון:
     IF local scan not found:
       → Skip (status: Skipped)
     
     IF local has pending changes in SyncOutbox:
       IF cloud.LastModifiedAt > local.LastModifiedAt:
         → Apply cloud update (status: Overridden)
       ELSE:
         → Keep local (status: Skipped)
     
     ELSE (no pending local changes):
       IF cloud.LastModifiedAt > local.LastModifiedAt:
         → Apply cloud update (status: Synced)
       ELSE:
         → Skip (status: Skipped)
   ```

4. **עדכון מקומי והשלמה**
   - עדכון `ExamScans` לוקאלי
   - `POST /api/sync/updates/:id/complete` עם הסטטוס

---

### מנגנון Retry ו-Idempotency

**Retry:**
- ניסיון חוזר כל 30 שניות
- אין מגבלת ניסיונות - ימשיך עד ההצלחה
- שמירת שגיאות ב-`LastError`

**Idempotency:**
- **PUSH**: Cloud API בודק אם `scanId` קיים (למנוע כפילויות)
- **PULL**: אם `completeCloudUpdate` נכשל, בסבב הבא פשוט יחזור על העדכון (safe!)
- כל פעולה **idempotent** - ניתן לבצע שוב ללא בעיה

---

### Last Write Wins Strategy

המערכת משתמשת ב-**timestamp-based conflict resolution**:
- `LastModifiedAt` קובע מי "מנצח"
- **היתרון**: פשוט ומובן
- **החיסרון**: עדכון ישן יכול לדרוס עדכון חדש אם Clock Skew קיים

**לייצור**: כדאי לשקול:
- Vector Clocks
- Version numbers
- User prompt למקרי conflict

## 🐛 בעיות נפוצות ופתרונות

### 1. הקונטיינרים לא עולים
```bash
# בדוק לוגים
docker-compose logs

# הרם מחדש
docker-compose down
docker-compose up --build
```

### 2. שגיאת חיבור ל-PostgreSQL
```bash
# וודא שה-DB עלה
docker ps | grep cloud-db

# אתחל מחדש
docker-compose restart cloud-db
docker-compose restart cloud-api
```

### 3. Frontend לא מתחבר ל-API
- וודא שה-Local API עובד: http://localhost:3001/health
- בדוק שה-CORS מאושר (כבר מוגדר ב-code)

### 4. הסנכרון לא עובד
```bash
# בדוק לוגים של Sync Worker
docker-compose logs sync-worker

# בדוק את תור הסנכרון
curl http://localhost:3001/local/sync/outbox
```

### 5. קבצים לא נשמרים
```bash
# וודא הרשאות לתיקיות
ls -la local-storage/scans
ls -la cloud-storage/scans
```

## 📊 בדיקות ומדדים

### 📋 איך לראות לוגים?

**לוגים בזמן אמת (כל השירותים):**
```powershell
docker-compose up
# הלוגים יופיעו ישירות בטרמינל
```

**לוגים של שירות ספציפי (בטרמינל נוסף):**
```powershell
docker-compose logs -f sync-worker    # Worker logs
docker-compose logs -f local-api      # Local API logs
docker-compose logs -f cloud-api      # Cloud API logs
docker-compose logs -f frontend       # Frontend logs
```

**לוגים של כל השירותים (ללא follow):**
```powershell
docker-compose logs
```

### 🧪 תרחישי בדיקה חובה

#### ✅ בדיקה 1: מצב רגיל (אונליין)

**מטרה:** לוודא שכל המערכת עובדת מתחילה ועד סוף

**שלבים:**

1. **פתח דפדפן:** http://localhost:3000

2. **העלה סריקה דרך UI:**
   - מזהה תלמיד: `123456`
   - מזהה מבחן: `MATH-2024-Q1`
   - בחר תמונה כלשהי

3. **בדוק לוגים - תראה:**
   ```
   local-api    | 📝 Created sync outbox entry: [uuid] for ExamScan:[scan-id]
   sync-worker  | 🟢 Cloud API is online - starting sync
   sync-worker  | 📤 Syncing 1 pending items...
   sync-worker  | 📦 Compressed: 5242880 → 1835120 bytes (65% reduction)
   sync-worker  | ✅ Synced: [scan-id]
   cloud-api    | ✅ Synced scan [scan-id] to cloud
   ```

4. **בדוק ב-UI (רענון אוטומטי כל 5 שניות):**
   - הסריקה תופיע ברשימה
   - סטטוס: `Synced` (ירוק)
   - מונה "סונכרן" יעלה ל-1

5. **בדיקה ידנית ב-API:**
   ```powershell
   # בדוק Local DB
   curl http://localhost:3001/local/scans
   
   # בדוק Cloud DB
   curl http://localhost:3002/api/sync/scans
   
   # בדוק סטטוס סנכרון
   curl http://localhost:3001/local/sync/status
   ```

6. **בדוק קבצים:**
   ```powershell
   # קובץ מקומי
   ls local-storage/scans
   
   # קובץ בענן
   ls cloud-storage/scans
   ```

**תוצאה מצופה:**
- ✅ הסריקה נשמרת מקומית מיד
- ✅ תוך 30 שניות היא מסתנכרנת לענן
- ✅ הקובץ קיים בשני המקומות
- ✅ רשומה קיימת ב-Cloud DB

---

#### 🔴 בדיקה 2: מצב Offline

**מטרה:** לוודא שהמערכת עובדת ללא חיבור לענן ומסתנכרנת אוטומטית כשהחיבור חוזר

**שלבים:**

1. **כבה את Cloud API (בטרמינל חדש):**
   ```powershell
   docker stop cloud-api
   ```

2. **בדוק לוגים - תראה:**
   ```
   sync-worker  | 🔴 Cloud API is offline
   ```

3. **העלה סריקה דרך UI:**
   - מזהה תלמיד: `789012`
   - מזהה מבחן: `ENGLISH-2024-Q2`
   - בחר תמונה

4. **בדוק ב-UI:**
   - הסריקה נשמרת בהצלחה
   - סטטוס: `Pending` (כתום)
   - מונה "ממתין לסנכרון" יעלה

5. **בדוק לוגים - תראה ניסיונות חוזרים:**
   ```
   sync-worker  | 🔴 Cloud API is offline
   # כל 30 שניות...
   ```

6. **בדוק SyncOutbox:**
   ```powershell
   curl http://localhost:3001/local/sync/outbox
   ```
   תראה רשומה עם:
   - `Status: "Pending"`
   - `RetryCount: 0, 1, 2...` (עולה כל 30 שניות)

7. **החזר את Cloud API:**
   ```powershell
   docker start cloud-api
   ```

8. **בדוק לוגים - תוך 30 שניות תראה:**
   ```
   sync-worker  | 🟢 Cloud API is online - starting sync
   sync-worker  | 📤 Syncing 1 pending items...
   sync-worker  | 📦 Compressed: ...
   sync-worker  | ✅ Synced: [scan-id]
   ```

9. **בדוק ב-UI:**
   - הסטטוס משתנה ל-`Synced` אוטומטית
   - מונה "סונכרן" עולה

**תוצאה מצופה:**
- ✅ הסריקה נשמרת מקומית גם בלי ענן
- ✅ Worker ממשיך לנסות כל 30 שניות
- ✅ כשהענן חוזר, הסנכרון מתבצע אוטומטית
- ✅ אין איבוד מידע

---

#### 🚀 בדיקה 3: כמה סריקות Offline

**מטרה:** לוודא שהמערכת יכולה להתמודד עם נפח גדול של סריקות שממתינות לסנכרון

**שלבים:**

1. **כבה את Cloud API:**
   ```powershell
   docker stop cloud-api
   ```

2. **העלה 20-50 סריקות:**
   - אפשר ידנית דרך UI
   - או בסקריפט (ראה למטה)

3. **בדוק סטטוס:**
   ```powershell
   curl http://localhost:3001/local/sync/status
   ```
   תראה:
   ```json
   {
     "status": {
       "pending": 20,
       "synced": 0,
       "failed": 0,
       "inProgress": 0
     }
   }
   ```

4. **בדוק שכל הקבצים נשמרו מקומית:**
   ```powershell
   ls local-storage/scans | Measure-Object
   ```

5. **החזר את Cloud API:**
   ```powershell
   docker start cloud-api
   ```

6. **עקוב אחר הסנכרון בלוגים:**
   ```powershell
   docker-compose logs -f sync-worker
   ```
   תראה:
   ```
   📤 Syncing 20 pending items...
   ✅ Synced: [id-1]
   ✅ Synced: [id-2]
   ...
   ✨ Sync cycle completed
   ```

7. **וודא שהכל סונכרן:**
   ```powershell
   # סטטוס
   curl http://localhost:3001/local/sync/status
   
   # כל הסריקות בענן
   curl http://localhost:3002/api/sync/scans
   ```

8. **בדוק קבצים בענן:**
   ```powershell
   ls cloud-storage/scans | Measure-Object
   ```

**תוצאה מצופה:**
- ✅ כל 20-50 הסריקות נשמרות מקומית
- ✅ כשהענן חוזר, כולן מסתנכרנות (אחת אחרי השנייה)
- ✅ אין איבוד מידע
- ✅ אין כפילויות

---

### 📋 מדריך בדיקות מפורט

לפרטים מלאים על בדיקות, סקריפטים, ודוגמאות לוגים - ראה:  
**[TESTING.md](TESTING.md)** - מדריך בדיקות מקיף עם סקריפטים עזר

---

## 🔧 הגדרות נוספות

### שינוי מרווח סנכרון

ערוך את [docker-compose.yml](docker-compose.yml):
```yaml
sync-worker:
  environment:
    - SYNC_INTERVAL=10000  # 10 שניות במקום 30
```

### שינוי גודל קובץ מקסימלי

ערוך את [local-api/src/routes/scans.js](local-api/src/routes/scans.js):
```javascript
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
```

## 🎯 תכונות מתקדמות להרחבה

רעיונות להמשך פיתוח:

1. **אימות וסיסמאות**
   - JWT tokens
   - Role-based access control

2. **שיפור ביצועים**
   - Batch sync (העלאת מספר קבצים יחד)
   - Delta sync (רק שינויים)
   - Connection pooling

3. **UI משופר**
   - Real-time progress bar
   - היסטוריית שגיאות
   - פילטרים וחיפוש

4. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Health checks מתקדמים

5. **אבטחת מידע**
   - הצפנת קבצים
   - HTTPS
   - Rate limiting

## 📝 הערות חשובות

### איכות הקוד
- קוד נקי ומתועד
- Error handling מקיף
- Logging ברור

### Production Considerations
- **אל תשתמש בזה ב-production כמו שהוא!**
- נדרש הוספת אבטחה
- נדרש backup ו-disaster recovery
- נדרש monitoring ו-alerting

### מגבלות POC
- אין authentication
- אין encryption
- SQLite לא מומלץ ל-production בקנה מידה
- אין horizontal scaling

## 🤝 תרומה ופיתוח

### הרצה מחוץ לדוקר (development)

Local API:
```bash
cd local-api
npm install
npm run dev
```

Cloud API:
```bash
cd cloud-api
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm start
```

## 📞 תמיכה

לשאלות ובעיות:
1. בדוק את הלוגים: `docker-compose logs [service-name]`
2. בדוק את ה-health endpoints
3. ודא שכל הפורטים פנויים

---

## ⚠️ נקודות חשובות לשים לב לפני מעבר ל-Production

### 🗜️ דחיסה ותצוגת קבצים

**מצב נוכחי ב-POC:**
- קבצים מועלים לענן **בפורמט דחוס (GZIP)**
- חוסך 60-70% bandwidth בזמן סנכרון ✅
- **אבל:** הקבצים בענן לא ניתנים לתצוגה ישירה ❌

**לפני Production - יש להחליט:**

**אופציה 1: פענוח מיד בענן (המומלץ לרוב המקרים)**
```javascript
// ב-Cloud API - לאחר קבלת הקובץ:
const decompressed = zlib.gunzipSync(compressedFile);
fs.writeFileSync(imagePath, decompressed);
```
- ✅ תצוגה מהירה של תמונות
- ✅ עובד עם כל כלי עיבוד תמונה
- ❌ גוזל יותר מקום אחסון

**אופציה 2: שמירה דחוסה + פענוח בזמן תצוגה**
```javascript
// בזמן הגשה:
app.get('/images/:id', (req, res) => {
  const compressed = fs.readFileSync(path);
  const image = zlib.gunzipSync(compressed);
  res.send(image);
});
```
- ✅ חוסך 60-70% מקום אחסון (משמעותי!)
- ✅ פענוח מהיר (~1-50ms)
- ❌ צריך caching חכם
- ❌ עומס CPU בכל תצוגה

**זמני פענוח:** 100KB → 1-5ms | 1MB → 10-30ms | 5MB → 50-100ms

**המלצה:** אם צפי לתצוגות תכופות → אופציה 1. אם אחסון יקר → אופציה 2 + cache.

---

### � אופטימיזציות אופציונליות לסנכרון

#### 1. מניעת עדכונים כפולים (Idempotency Check)

**מצב נוכחי ב-POC:**
- Sync Worker מושך עדכונים מהענן בכל סבב (30 שניות)
- אם `completeCloudUpdate()` נכשל (אובדן חיבור), העדכון יחזור בסבב הבא
- העדכון יבוצע שוב **אבל זה בטוח** - idempotent operation ✅

**דוגמת תרחיש:**
```
סבב 1: 
  ✅ Pull update (Grade=95) 
  ✅ Update local DB
  ❌ completeCloudUpdate() נכשל - אין גישה לענן

סבב 2:
  ✅ Pull same update שוב
  ✅ Update local DB שוב (אותו ערך = אין בעיה)
  ✅ completeCloudUpdate() הצליח הפעם
```

**שיפור אופציונלי (לא הוסף ב-POC):**
```javascript
// בדיקה מקדימה להימנע מעדכון מיותר:
const cloudTime = new Date(update.LastModifiedAt).getTime();
const localTime = new Date(localScan.LastModifiedAt).getTime();

if (cloudTime === localTime && 
    localScan.Grade === update.Grade && 
    localScan.Comments === update.Comments) {
    // Already synced - just mark as complete
    await completeCloudUpdate(update.Id, 'Synced');
    continue; // Skip DB update
}
```

**יתרונות:**
- ✅ פחות עדכוני DB מיותרים
- ✅ פחות לוגים

**חסרונות:**
- ❌ לוגיקה נוספת
- ❌ התועלת מינימלית (DB update מהיר ממילא)

**המלצה:** לא נחוץ למרוב המקרים. הוסף רק אם יש load גבוה מאוד.

---

#### 2. שדה SyncedAt בטבלת ExamScans

**מצב נוכחי ב-POC:**
```sql
ExamScans:
  - CreatedAt       -- תאריך יצירה מקורי
  - LastModifiedAt  -- תאריך עדכון אחרון (Grade/Comments)
```

**תאריך הסנכרון נמצא רק ב:**
- `SyncOutbox.SyncedAt` (Local → Cloud)
- `CloudSyncOutbox.SyncedAt` (Cloud → Local)

**שיפור אופציונלי (לא הוסף ב-POC):**
```sql
ExamScans:
  - CreatedAt       -- תאריך יצירה מקורי
  - LastModifiedAt  -- תאריך עדכון אחרון
  - SyncedAt        -- מתי סונכרן לצד השני לאחרונה ⭐ חדש
```

**יתרונות:**
- ✅ מידע סנכרון זמין ישירות בטבלה הראשית
- ✅ קל לזהות סריקות שטרם סונכרנו
- ✅ שאילתות פשוטות יותר למעקב

**חסרונות:**
- ❌ מורכבות נוספת
- ❌ צריך לעדכן גם ExamScans וגם Outbox
- ❌ דופליקציה של מידע

**המלצה:** הוסף רק אם צריך UI מתקדם שמציג "Last Synced" בצד כל רשומה.

---

### �📝 נקודות נוספות לבדיקה

*(מקום לנקודות עתידיות)*

---

**בהצלחה! 🚀**

*POC נוצר ב-2026 - Offline-First Architecture Demo*
