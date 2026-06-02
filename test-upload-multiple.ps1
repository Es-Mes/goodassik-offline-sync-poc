# Upload multiple scans for testing
param(
    [int]$Count = 50,
    [string]$ApiUrl = "http://localhost:3001"
)

Write-Host "Uploading $Count scans..." -ForegroundColor Cyan
Write-Host ""

for ($i = 1; $i -le $Count; $i++) {
    $studentId = "STU" + (Get-Random -Minimum 10000 -Maximum 99999)
    $examId = "EXAM-2024-" + (Get-Random -Minimum 100 -Maximum 999)
    
    # Create dummy file
    $tempFile = [System.IO.Path]::GetTempFileName()
    $randomData = [byte[]]::new(1024 * 100) # 100KB
    (New-Object Random).NextBytes($randomData)
    [System.IO.File]::WriteAllBytes($tempFile, $randomData)
    
    try {
        # Use curl.exe explicitly
        curl.exe -X POST "$ApiUrl/local/scans" `
            -F "studentId=$studentId" `
            -F "examId=$examId" `
            -F "image=@$tempFile" `
            --silent | Out-Null
        
        Write-Host "[$i/$Count] SUCCESS: $studentId - $examId" -ForegroundColor Green
    }
    catch {
        Write-Host "[$i/$Count] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
    finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Milliseconds 50
}

Write-Host ""
Write-Host "COMPLETED! Check status:" -ForegroundColor Yellow
Write-Host "  curl http://localhost:3001/local/sync/status" -ForegroundColor Cyan
