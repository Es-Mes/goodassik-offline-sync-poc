# 🧪 מדריך בדיקות מלא - Bi-Directional Sync POC

## 🎯 מטרת המסמך

מדריך מקיף לבדיקת כל תכונות המערכת:
- ✅ סנכרון חד-כיווני (Local → Cloud)
- ✅ סנכרון דו-כיווני (Local ⇄ Cloud)
- ✅ Conflict Resolution
- ✅ מצבי Offline/Online
- ✅ עדכון ציונים והערות

---

## 🎯 סקריפטים עזר לבדיקות

### סקריפט להעלאת סריקות רבות (PowerShell)

שמור כ-`test-upload-multiple.ps1`:

```powershell
# העלאת מספר סריקות לבדיקה
param(
    [int]$Count = 20,
    [string]$ApiUrl = "http://localhost:3001"
)

Write-Host "מעלה $Count סריקות..." -ForegroundColor Cyan

for ($i = 1; $i -le $Count; $i++) {
    $studentId = "STU" + (Get-Random -Minimum 10000 -Maximum 99999)
    $examId = "EXAM-2024-" + (Get-Random -Minimum 100 -Maximum 999)
    
    # יצירת קובץ דמה
    $tempFile = [System.IO.Path]::GetTempFileName()
    $randomData = [byte[]]::new(1024 * 100) # 100KB
    (New-Object Random).NextBytes($randomData)
    [System.IO.File]::WriteAllBytes($tempFile, $randomData)
    
    try {
        $form = @{
            studentId = $studentId
            examId = $examId
            image = Get-Item $tempFile
        }
        
        $response = Invoke-WebRequest -Uri "$ApiUrl/local/scans" -Method Post -Form $form
        Write-Host "[$i/$Count] ✅ הועלה: $studentId - $examId" -ForegroundColor Green
    }
    catch {
        Write-Host "[$i/$Count] ❌ שגיאה: $($_.Exception.Message)" -ForegroundColor Red
    }
    finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Milliseconds 100
}

Write-Host "`n✨ הושלם! בדוק סטטוס: curl http://localhost:3001/local/sync/status" -ForegroundColor Yellow
```

**שימוש:**
```powershell
# העלה 20 סריקות
.\test-upload-multiple.ps1

# העלה 50 סריקות
.\test-upload-multiple.ps1 -Count 50
```

---

## 📊 דוגמאות לוגים - מה לצפות לראות

### ✅ לוגים תקינים - מצב אונליין

```
local-api    | 🚀 Local API running on port 3001
local-api    | ✅ Local database initialized

cloud-api    | ☁️  Cloud API running on port 3002
cloud-api    | ✅ Cloud database initialized

sync-worker  | 🚀 Sync Worker started
sync-worker  | ⏱️  Sync interval: 30000ms (30s)
sync-worker  | 🟢 Cloud API is online - starting sync

# העלאת סריקה
local-api    | POST /local/scans 201 - 45ms
local-api    | 📝 Created sync outbox entry: abc-123-def for ExamScan:xyz-789

# סנכרון
sync-worker  | 📤 Syncing 1 pending items...
sync-worker  | 📦 Compressed: 5242880 → 1835120 bytes (65.00% reduction)
sync-worker  | ✅ Synced: xyz-789
sync-worker  | ✨ Sync cycle completed

cloud-api    | POST /api/sync/scans 201 - 123ms
cloud-api    | ✅ Synced scan xyz-789 to cloud
```

---

### 🔴 לוגים במצב Offline

```
sync-worker  | 🔴 Cloud API is offline

# ניסיון סנכרון נכשל
sync-worker  | 📤 Syncing 3 pending items...
sync-worker  | ❌ Failed to sync abc-123: connect ECONNREFUSED 172.18.0.4:3002
# חוזר כל 30 שניות...

sync-worker  | 🔴 Cloud API is offline
```

---

### 🟢 לוגים כשהחיבור חוזר

```
sync-worker  | 🟢 Cloud API is online - starting sync
sync-worker  | 📤 Syncing 15 pending items...

sync-worker  | 📦 Compressed: 5242880 → 1835120 bytes (65.00% reduction)
sync-worker  | ✅ Synced: item-1

sync-worker  | 📦 Compressed: 4856320 → 1654200 bytes (65.94% reduction)
sync-worker  | ✅ Synced: item-2

...

sync-worker  | ✅ Synced: item-15
sync-worker  | ✨ Sync cycle completed

cloud-api    | ✅ Synced scan item-1 to cloud
cloud-api    | ✅ Synced scan item-2 to cloud
...
```

---

### ❌ לוגים של שגיאות נפוצות

**קובץ לא נמצא:**
```
sync-worker  | ❌ Failed to sync xyz-789: Error: File not found: /app/storage/scans/missing.jpg
```

**Cloud DB לא זמין:**
```
cloud-api    | Error syncing scan: connect ECONNREFUSED postgres:5432
cloud-api    | Failed to sync scan
```

**קובץ גדול מדי:**
```
local-api    | Error creating scan: File too large
local-api    | POST /local/scans 400 - 12ms
```

---

## 📈 מדדים ומדידות

### בדיקת ביצועי דחיסה

```powershell
# הרץ בדיקה עם קובץ גדול
$largeFile = "test-5mb.jpg" # 5MB
curl -X POST http://localhost:3001/local/scans `
  -F "studentId=TEST-USER" `
  -F "examId=PERF-TEST" `
  -F "image=@$largeFile"

# בדוק לוגים לראות את יחס הדחיסה
docker-compose logs sync-worker | Select-String "Compressed"
```

**יחס דחיסה טוב:** 60-70% חיסכון  
**יחס דחיסה בינוני:** 40-60% חיסכון  
**יחס דחיסה נמוך:** < 40% חיסכון (קבצים כבר דחוסים)

---

### בדיקת זמן סנכרון

```powershell
# כבה ענן
docker stop cloud-api

# העלה סריקה
$start = Get-Date
curl -X POST http://localhost:3001/local/scans `
  -F "studentId=TIMING-TEST" `
  -F "examId=TIME-001" `
  -F "image=@test.jpg"

# הפעל ענן
docker start cloud-api

# בדוק מתי הסנכרון הושלם
docker-compose logs -f sync-worker

# חשב זמן
$end = Get-Date
$duration = $end - $start
Write-Host "⏱️ זמן כולל: $($duration.TotalSeconds) שניות"
```

**זמנים מצופים:**
- שמירה מקומית: < 1 שניה
- סנכרון (אונליין): 1-30 שניות (תלוי במרווח polling)
- סנכרון אחרי offline: 30-60 שניות (מרווח + העלאה)

---

## 🔍 פקודות בדיקה מועילות

### בדיקת מצב כל הקונטיינרים

```powershell
docker-compose ps
```

**פלט תקין:**
```
NAME         IMAGE                  STATUS
cloud-api    cloud-api             Up
cloud-db     postgres:15-alpine    Up (healthy)
frontend     frontend              Up
local-api    local-api             Up
sync-worker  sync-worker           Up
```

---

### בדיקת בריאות שירותים

```powershell
# Local API
curl http://localhost:3001/health

# Cloud API
curl http://localhost:3002/health

# PostgreSQL
docker exec cloud-db pg_isready -U clouduser
```

---

### בדיקת מסד נתונים

**SQLite (Local):**
```powershell
# הכנס לקונטיינר
docker exec -it local-api sh

# פתח DB
sqlite3 /app/data/local.db

# שאילתות
SELECT COUNT(*) FROM ExamScans;
SELECT * FROM SyncOutbox WHERE Status = 'Pending';
SELECT SyncStatus, COUNT(*) FROM ExamScans GROUP BY SyncStatus;

# יציאה
.exit
exit
```

**PostgreSQL (Cloud):**
```powershell
# הכנס לקונטיינר
docker exec -it cloud-db psql -U clouduser -d cloud_scans_db

# שאילתות
SELECT COUNT(*) FROM examscans;
SELECT * FROM examscans ORDER BY syncedat DESC LIMIT 10;

# יציאה
\q
```

---

### בדיקת שימוש בדיסק

```powershell
# כמה קבצים נשמרו מקומית
(Get-ChildItem "local-storage/scans").Count

# כמה קבצים נשמרו בענן
(Get-ChildItem "cloud-storage/scans").Count

# גודל כולל
Get-ChildItem "local-storage/scans" | Measure-Object -Property Length -Sum
Get-ChildItem "cloud-storage/scans" | Measure-Object -Property Length -Sum
```

---

## � בדיקות Bi-Directional Sync

### 🧪 בדיקה 4: עדכון ציון ב-Local

**מטרה:** לוודא שעדכון בצד Local מסתנכרן ל-Cloud

**שלבים:**

1. **העלה סריקה:**
   - דרך UI: תלמיד `111222`, מבחן `BIO-2024-Q1`
   - המתן לסנכרון (30 שניות)

2. **עדכן ציון ב-Local:**
   ```powershell
   # קבל את ה-ID של הסריקה
   $scans = curl http://localhost:3001/local/scans | ConvertFrom-Json
   $scanId = $scans.scans[0].Id
   
   # עדכן ציון
   curl -X PATCH "http://localhost:3001/local/scans/$scanId" `
     -H "Content-Type: application/json" `
     -d '{"grade": 95, "comments": "Excellent work!"}'
   ```

3. **בדוק SyncOutbox:**
   ```powershell
   curl http://localhost:3001/local/sync/outbox
   ```
   תראה entry חדש עם `Action: "Update"`

4. **המתן 30 שניות - בדוק בענן:**
   ```powershell
   curl http://localhost:3002/api/sync/scans
   ```
   הציון יהיה 95 והערה "Excellent work!"

5. **בדוק ב-UI:**
   - Local Panel: Grade=95
   - Cloud Panel: Grade=95 (אחרי רענון)

**תוצאה מצופה:**
- ✅ עדכון Local נשמר מיד
- ✅ SyncOutbox נוצר אוטומטית
- ✅ תוך 30 שניות מסתנכרן ל-Cloud
- ✅ שני הצדדים זהים

---

### 🧪 בדיקה 5: עדכון ציון ב-Cloud

**מטרה:** לוודא שעדכון בצד Cloud מסתנכרן ל-Local

**שלבים:**

1. **קבל ID של סריקה מסונכרנת:**
   ```powershell
   $cloudScans = curl http://localhost:3002/api/sync/scans | ConvertFrom-Json
   $scanId = $cloudScans.scans[0].id
   ```

2. **עדכן ציון ב-Cloud:**
   ```powershell
   curl -X PATCH "http://localhost:3002/api/sync/scans/$scanId" `
     -H "Content-Type: application/json" `
     -d '{"grade": 88, "comments": "Good job from cloud!"}'
   ```

3. **בדוק CloudSyncOutbox:**
   ```powershell
   curl http://localhost:3002/api/sync/updates
   ```
   תראה entry עם הציון החדש

4. **המתן 30 שניות - בדוק ב-Local:**
   ```powershell
   curl http://localhost:3001/local/scans
   ```
   הציון יהיה 88 והערה "Good job from cloud!"

5. **בדוק לוגים:**
   ```
   sync-worker  | 📥 Pulling 1 cloud updates...
   sync-worker  | ✅ Applying cloud update for [scan-id]
   ```

**תוצאה מצופה:**
- ✅ עדכון Cloud נשמר מיד
- ✅ CloudSyncOutbox נוצר אוטומטית
- ✅ תוך 30 שניות מורד ל-Local
- ✅ שני הצדדים זהים

---

### 🧪 בדיקה 6: Conflict Resolution - Cloud Wins

**מטרה:** לוודא שכשיש קונפליקט, הצד החדש יותר מנצח

**שלבים:**

1. **העלה סריקה והמתן לסנכרון**

2. **עדכן ב-Local ראשון:**
   ```powershell
   curl -X PATCH "http://localhost:3001/local/scans/$scanId" `
     -d '{"grade": 70, "comments": "From local at 10:00"}'
   ```
   
3. **אל תחכה! מיד עדכן ב-Cloud:**
   ```powershell
   curl -X PATCH "http://localhost:3002/api/sync/scans/$scanId" `
     -d '{"grade": 90, "comments": "From cloud at 10:01"}'
   ```

4. **המתן 30 שניות - בדוק לוגים:**
   ```
   sync-worker  | 📤 Syncing... (Push local first)
   sync-worker  | 📥 Pulling... (Then pull cloud)
   sync-worker  | ⚠️  Conflict detected for scan [id]
   sync-worker  | 🔄 Cloud is newer, overriding local changes
   ```

5. **בדוק שני הצדדים:**
   ```powershell
   curl http://localhost:3001/local/scans
   curl http://localhost:3002/api/sync/scans
   ```
   **שניהם יהיו:** Grade=90, Comments="From cloud at 10:01"

**תוצאה מצופה:**
- ✅ Cloud מנצח (LastModifiedAt חדש יותר)
- ✅ Local מתעדכן ל-90
- ✅ CloudSyncOutbox סטטוס: `Overridden`
- ✅ אין איבוד מידע (הכל בלוגים)

---

### 🧪 בדיקה 7: Conflict Resolution - Local Wins

**מטרה:** לוודא שאם Local חדש יותר, Cloud לא דורס אותו

**שלבים:**

1. **העלה סריקה והמתן לסנכרון**

2. **עדכן ב-Cloud ראשון:**
   ```powershell
   curl -X PATCH "http://localhost:3002/api/sync/scans/$scanId" `
     -d '{"grade": 80, "comments": "From cloud at 11:00"}'
   ```

3. **המתן 35 שניות (לאחר Pull)**

4. **עכשיו עדכן ב-Local:**
   ```powershell
   curl -X PATCH "http://localhost:3001/local/scans/$scanId" `
     -d '{"grade": 95, "comments": "From local at 11:02"}'
   ```

5. **המתן עוד 30 שניות - בדוק לוגים:**
   ```
   sync-worker  | 📥 Pulling cloud updates...
   sync-worker  | ⏭️  Local is newer, skipping cloud update
   ```

6. **בדוק CloudSyncOutbox:**
   ```powershell
   curl http://localhost:3002/api/sync/updates
   ```
   תראה Status: `Skipped`

**תוצאה מצופה:**
- ✅ Local מנצח (LastModifiedAt חדש יותר)
- ✅ Cloud לא דורס את Local
- ✅ CloudSyncOutbox סטטוס: `Skipped`

---

### 🧪 בדיקה 8: זיהוי Conflict ב-UI

**מטרה:** לראות סימון ויזואלי של קונפליקטים

**שלבים:**

1. **פתח UI:** http://localhost:3000

2. **יצור קונפליקט:**
   - עדכן ציון ב-Local (דרך UI): 75
   - מיד עדכן ב-Cloud (דרך curl): 85
   - **לפני** שהסנכרון מסתיים

3. **בדוק ב-UI:**
   - הכרטיס יסומן ב-⚠️ "קונפליקט"
   - רקע צהוב
   - תראה ערכים שונים: Local=75, Cloud=85

4. **המתן 30 שניות:**
   - הקונפליקט יפתר אוטומטית
   - הסימון יעלם
   - שני הצדדים יהיו זהים

**תוצאה מצופה:**
- ✅ UI מזהה קונפליקט בזמן אמת
- ✅ סימון ויזואלי ברור
- ✅ רזולושן אוטומטי
- ✅ רענון אוטומטי

---

## �🛠️ תיקון בעיות נפוצות

### הסנכרון תקוע

```powershell
# 1. בדוק לוגים
docker-compose logs sync-worker

# 2. בדוק pending items
curl http://localhost:3001/local/sync/outbox

# 3. אתחל worker
docker-compose restart sync-worker
```

---

### קבצים חסרים

```powershell
# בדוק שהתיקיות קיימות
Test-Path "local-storage/scans"
Test-Path "cloud-storage/scans"

# צור מחדש אם חסרות
New-Item -ItemType Directory -Force -Path "local-storage/scans"
New-Item -ItemType Directory -Force -Path "cloud-storage/scans"

# אתחל קונטיינרים
docker-compose restart
```

---

### DB לא מאותחל

```powershell
# מחק volumes ואתחל מחדש
docker-compose down -v
docker-compose up --build
```

---

## 📝 Checklist לסיום בדיקות

### בדיקות בסיסיות ✅
- [ ] כל הקונטיינרים רצים (`docker-compose ps`)
- [ ] UI נגיש ב-http://localhost:3000
- [ ] העלאת סריקה במצב אונליין עובדת
- [ ] הסריקה מסתנכרנת תוך 30 שניות
- [ ] קובץ קיים ב-`local-storage/scans`
- [ ] קובץ קיים ב-`cloud-storage/scans`
- [ ] רשומה ב-Cloud DB

### בדיקות Bi-Directional Sync ✅
- [ ] עדכון ציון ב-Local מסתנכרן ל-Cloud
- [ ] עדכון ציון ב-Cloud מסתנכרן ל-Local
- [ ] Conflict Resolution - Cloud חדש יותר (Overridden)
- [ ] Conflict Resolution - Local חדש יותר (Skipped)
- [ ] UI מזהה קונפליקטים ויזואלית
- [ ] CloudSyncOutbox עובד כמצופה
- [ ] Pull logic רץ כל 30 שניות

### בדיקות Offline/Online ✅
- [ ] מצב Offline - סריקות נשמרות מקומית
- [ ] מצב Offline - עדכונים נשארים Pending
- [ ] חזרה Online - סנכרון אוטומטי
- [ ] כמה סריקות Offline מסתנכרנות

---

## 🎓 טיפים לבדיקות

### מעקב אחר סנכרון בזמן אמת

```powershell
# טרמינל 1: לוגים
docker-compose logs -f sync-worker

# טרמינל 2: פולינג סטטוס
while ($true) {
    curl http://localhost:3001/local/sync/status | ConvertFrom-Json | ConvertTo-Json
    Start-Sleep 5
}

# טרמינל 3: בדיקות
```

### מחיקת נתונים בין בדיקות

```powershell
# מחיקה מלאה
docker-compose down -v
docker-compose up --build

# מחיקת קבצים בלבד
Remove-Item local-storage/scans/* -Force
Remove-Item cloud-storage/scans/* -Force
docker-compose restart
```

### דיבוג CloudSyncOutbox

```powershell
# קבל עדכונים ממתינים
curl http://localhost:3002/api/sync/updates

# סמן עדכון כהושלם ידנית
curl -X POST "http://localhost:3002/api/sync/updates/UPDATE_ID/complete" `
  -H "Content-Type: application/json" `
  -d '{"status": "Synced"}'
```

---

**בהצלחה! 🚀**

*אם יש בעיות - בדוק את [README.md](README.md) או את הלוגים.*
- [ ] במצב offline - סריקה נשמרת עם סטטוס Pending
- [ ] כשהענן חוזר - סנכרון אוטומטי עובד
- [ ] 20+ סריקות offline מסתנכרנות בהצלחה
- [ ] דחיסת GZIP עובדת (בדוק לוגים)
- [ ] אין כפילויות ב-Cloud DB (Idempotency)
- [ ] UI מתעדכן אוטומטית (רענון כל 5 שניות)

---

**🎉 אם הכל עובר - המערכת מוכנה!**
