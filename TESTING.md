# 🧪 מדריך בדיקות מלא - POC Offline Sync

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

## 🛠️ תיקון בעיות נפוצות

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

- [ ] כל הקונטיינרים רצים (`docker-compose ps`)
- [ ] UI נגיש ב-http://localhost:3000
- [ ] העלאת סריקה במצב אונליין עובדת
- [ ] הסריקה מסתנכרנת תוך 30 שניות
- [ ] קובץ קיים ב-`local-storage/scans`
- [ ] קובץ קיים ב-`cloud-storage/scans`
- [ ] רשומה ב-Cloud DB
- [ ] במצב offline - סריקה נשמרת עם סטטוס Pending
- [ ] כשהענן חוזר - סנכרון אוטומטי עובד
- [ ] 20+ סריקות offline מסתנכרנות בהצלחה
- [ ] דחיסת GZIP עובדת (בדוק לוגים)
- [ ] אין כפילויות ב-Cloud DB (Idempotency)
- [ ] UI מתעדכן אוטומטית (רענון כל 5 שניות)

---

**🎉 אם הכל עובר - המערכת מוכנה!**
