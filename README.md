# 🚀 Offline-First Scan Sync POC

## סקירה כללית

פרויקט POC (Proof of Concept) המדגים מערכת offline-first לניהול סריקות מבחנים עם יכולות סנכרון אוטומטי לענן.

המערכת תומכת בשני מצבים:
- **אונליין** - נתונים נשמרים מקומית ומסתנכרנים מיידית לענן
- **אופליין** - נתונים נשמרים מקומית ומסתנכרנים אוטומטית כשהחיבור חוזר

## 🏗️ ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────┐
│                      Local Environment                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────┐   │
│  │ Frontend │─────►│  Local API   │      │ Sync Worker │   │
│  │ (React)  │      │  (Node.js)   │◄─────│  (Node.js)  │   │
│  └──────────┘      └──────────────┘      └─────────────┘   │
│                           │                      │           │
│                           ▼                      │           │
│                    ┌──────────┐                  │           │
│                    │ SQLite   │                  │           │
│                    │    DB    │                  │           │
│                    └──────────┘                  │           │
│                           │                      │           │
│                           ▼                      ▼           │
│                    ┌────────────────────────────────┐        │
│                    │    Local Storage (Files)      │        │
│                    └────────────────────────────────┘        │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                         Sync (גזיפ + העלאה)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Environment                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    ┌──────────────┐                          │
│                    │  Cloud API   │                          │
│                    │  (Node.js)   │                          │
│                    └──────────────┘                          │
│                           │                                   │
│         ┌─────────────────┴─────────────────┐                │
│         │                                   │                │
│         ▼                                   ▼                │
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
```bash
docker-compose up --build
```

השירותים יעלו על הפורטים הבאים:
- **Frontend**: http://localhost:3000
- **Local API**: http://localhost:3001
- **Cloud API**: http://localhost:3002
- **PostgreSQL**: localhost:5432

### שלב 3: בדיקת הפעלה
פתח דפדפן וגש ל: http://localhost:3000

## 📋 שימוש במערכת

### 1. העלאת סריקה חדשה

דרך הממשק (Frontend):
1. הזן מזהה תלמיד (לדוגמה: 123456)
2. הזן מזהה מבחן (לדוגמה: MATH-2024-Q1)
3. בחר קובץ תמונה
4. לחץ "שמור סריקה"

הסריקה תישמר מיידית במסד הנתונים המקומי ותתווסף לתור הסנכרון.

### 2. מעקב אחר סטטוס סנכרון

הממשק מציג בזמן אמת:
- **ממתין לסנכרון** - מספר פריטים שממתינים
- **מסתנכרן** - פריטים בתהליך העברה
- **סונכרן** - פריטים שהועברו בהצלחה
- **נכשל** - פריטים שנכשלו בסנכרון

### 3. דימוי מצב אופליין

להפעלת מצב אופליין (ללא חיבור לענן):
```bash
docker stop cloud-api
```

כעת כל סריקה חדשה:
- תישמר מקומית בהצלחה
- תישאר בסטטוס "Pending"
- ה-Sync Worker ימשיך לנסות כל 30 שניות

להחזרת החיבור:
```bash
docker start cloud-api
```

תוך 30 שניות הסנכרון יחזור והנתונים יועלו אוטומטית!

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

## 🗄️ מבנה מסדי נתונים

### Local DB (SQLite)

**ExamScans**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | TEXT | מזהה ייחודי (UUID) |
| StudentId | TEXT | מזהה תלמיד |
| ExamId | TEXT | מזהה מבחן |
| ImagePath | TEXT | נתיב לקובץ |
| CreatedAt | TEXT | תאריך יצירה (ISO) |
| SyncStatus | TEXT | Pending/Syncing/Synced/Failed |

**SyncOutbox**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | TEXT | מזהה ייחודי |
| EntityType | TEXT | סוג הישות (ExamScan) |
| EntityId | TEXT | מזהה הישות |
| Action | TEXT | Create/Update/Delete |
| Status | TEXT | Pending/InProgress/Synced/Failed |
| RetryCount | INTEGER | מספר ניסיונות חוזרים |
| LastError | TEXT | הודעת שגיאה אחרונה |
| CreatedAt | TEXT | תאריך יצירה |
| SyncedAt | TEXT | תאריך סנכרון |

### Cloud DB (PostgreSQL)

**ExamScans**
| שדה | סוג | תיאור |
|------|------|--------|
| Id | VARCHAR(255) | מזהה ייחודי |
| StudentId | VARCHAR(255) | מזהה תלמיד |
| ExamId | VARCHAR(255) | מזהה מבחן |
| ImagePath | TEXT | נתיב לקובץ |
| CreatedAt | TIMESTAMP | תאריך יצירה |
| SyncedAt | TIMESTAMP | תאריך סנכרון |

## 🔄 תהליך הסנכרון

### Flow מלא:

1. **שמירה מקומית**
   - משתמש מעלה סריקה דרך Frontend
   - Local API שומר ב-SQLite + Local Storage
   - נוצרת רשומה ב-SyncOutbox עם סטטוס "Pending"

2. **Sync Worker - polling**
   - כל 30 שניות בודק אם Cloud API זמין
   - מחפש רשומות Pending ב-SyncOutbox
   
3. **העברת קובץ**
   - דחיסת הקובץ ב-GZIP (חיסכון בנפח העברה)
   - העלאה ל-Cloud API עם multipart/form-data
   - מחיקת קובץ דחוס זמני

4. **עדכון סטטוס**
   - הצלחה: SyncStatus → "Synced"
   - כשלון: SyncStatus → "Failed", RetryCount++

### מנגנון Retry

- **ניסיון חוזר**: כל 30 שניות
- **אין מגבלת ניסיונות**: ימשיך עד ההצלחה
- **שמירת שגיאות**: LastError מכיל את הסיבה לכשלון
- **אין מחיקת נתונים**: Pending items נשארים עד סנכרון מוצלח

### Idempotency

Cloud API בודק אם scanId כבר קיים במסד הנתונים:
- אם קיים: מחזיר הצלחה (למנוע כפילויות)
- אם לא: שומר את הנתונים

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

### 📝 נקודות נוספות לבדיקה

*(מקום לנקודות עתידיות)*

---

**בהצלחה! 🚀**

*POC נוצר ב-2026 - Offline-First Architecture Demo*
