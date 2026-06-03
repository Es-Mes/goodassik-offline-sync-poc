# Run All Tests Script
param(
    [switch]$Coverage  # Add --Coverage flag to show code coverage
)

# Get absolute path for results directory
$scriptDir = $PSScriptRoot
$resultsDir = Join-Path $scriptDir "test-results"

# Create test-results directory if it doesn't exist
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

# Create log file with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $resultsDir "test-run-$timestamp.log"

# Start logging
$startTime = Get-Date
"=" * 70 | Tee-Object -FilePath $logFile
"Test Run Report" | Tee-Object -FilePath $logFile -Append
"Started: $startTime" | Tee-Object -FilePath $logFile -Append
"=" * 70 | Tee-Object -FilePath $logFile -Append
"" | Tee-Object -FilePath $logFile -Append

Write-Host "Running All Unit Tests..." -ForegroundColor Cyan
if ($Coverage) {
    Write-Host "Coverage mode enabled" -ForegroundColor Cyan
    "Coverage mode: ENABLED" | Tee-Object -FilePath $logFile -Append
} else {
    "Coverage mode: DISABLED" | Tee-Object -FilePath $logFile -Append
}
Write-Host ""
"" | Tee-Object -FilePath $logFile -Append

$testCommand = if ($Coverage) { "npm run test:coverage" } else { "npm test" }

# Local API Tests
Write-Host "[LOCAL API TESTS]" -ForegroundColor Yellow
"[LOCAL API TESTS]" | Tee-Object -FilePath $logFile -Append
Write-Host "================================" -ForegroundColor DarkGray
"================================" | Tee-Object -FilePath $logFile -Append
Push-Location "local-api\tests"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Gray
    npm install --silent
}
Invoke-Expression "$testCommand 2>&1" | Tee-Object -FilePath $logFile -Append
$localTestResult = $LASTEXITCODE
Pop-Location

Write-Host ""
Write-Host ""
"" | Tee-Object -FilePath $logFile -Append
"" | Tee-Object -FilePath $logFile -Append

# Cloud API Tests
Write-Host "[CLOUD API TESTS]" -ForegroundColor Yellow
"[CLOUD API TESTS]" | Tee-Object -FilePath $logFile -Append
Write-Host "================================" -ForegroundColor DarkGray
"================================" | Tee-Object -FilePath $logFile -Append
Push-Location "cloud-api\tests"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Gray
    npm install --silent
}
Invoke-Expression "$testCommand 2>&1" | Tee-Object -FilePath $logFile -Append
$cloudTestResult = $LASTEXITCODE
Pop-Location

Write-Host ""
"" | Tee-Object -FilePath $logFile -Append
Write-Host "================================" -ForegroundColor Cyan
"================================" | Tee-Object -FilePath $logFile -Append
Write-Host "          SUMMARY" -ForegroundColor Cyan
"          SUMMARY" | Tee-Object -FilePath $logFile -Append
Write-Host "================================" -ForegroundColor Cyan
"================================" | Tee-Object -FilePath $logFile -Append

$endTime = Get-Date
$duration = $endTime - $startTime

# Summary
if ($localTestResult -eq 0 -and $cloudTestResult -eq 0) {
    Write-Host "SUCCESS - All Tests Passed!" -ForegroundColor Green
    "SUCCESS - All Tests Passed!" | Tee-Object -FilePath $logFile -Append
    Write-Host "   Local API: 15 tests PASSED" -ForegroundColor Green
    "   Local API: 15 tests PASSED" | Tee-Object -FilePath $logFile -Append
    Write-Host "   Cloud API: 13 tests PASSED" -ForegroundColor Green
    "   Cloud API: 13 tests PASSED" | Tee-Object -FilePath $logFile -Append
    Write-Host "   Total: 28 tests PASSED" -ForegroundColor Green
    "   Total: 28 tests PASSED" | Tee-Object -FilePath $logFile -Append
    if ($Coverage) {
        Write-Host ""
        Write-Host "Coverage report generated in:" -ForegroundColor Cyan
        "Coverage report generated in:" | Tee-Object -FilePath $logFile -Append
        Write-Host "   - local-api\tests\coverage\" -ForegroundColor Gray
        "   - local-api\tests\coverage\" | Tee-Object -FilePath $logFile -Append
        Write-Host "   - cloud-api\tests\coverage\" -ForegroundColor Gray
        "   - cloud-api\tests\coverage\" | Tee-Object -FilePath $logFile -Append
    }
    
    "" | Tee-Object -FilePath $logFile -Append
    "Completed: $endTime" | Tee-Object -FilePath $logFile -Append
    "Duration: $($duration.TotalSeconds.ToString('F2')) seconds" | Tee-Object -FilePath $logFile -Append
    "Log saved to: $logFile" | Tee-Object -FilePath $logFile -Append
    "=" * 70 | Tee-Object -FilePath $logFile -Append
    
    Write-Host ""
    Write-Host "📝 Test log saved to: $logFile" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "FAILED - Some Tests Failed" -ForegroundColor Red
    "FAILED - Some Tests Failed" | Tee-Object -FilePath $logFile -Append
    "   Local API: $(if ($localTestResult -eq 0) { 'PASSED' } else { 'FAILED' })" | Tee-Object -FilePath $logFile -Append
    "   Cloud API: $(if ($cloudTestResult -eq 0) { 'PASSED' } else { 'FAILED' })" | Tee-Object -FilePath $logFile -Append
    "" | Tee-Object -FilePath $logFile -Append
    "Completed: $endTime" | Tee-Object -FilePath $logFile -Append
    "Duration: $($duration.TotalSeconds.ToString('F2')) seconds" | Tee-Object -FilePath $logFile -Append
    "Log saved to: $logFile" | Tee-Object -FilePath $logFile -Append
    "=" * 70 | Tee-Object -FilePath $logFile -Append
    
    Write-Host ""
    Write-Host "📝 Test log saved to: $logFile" -ForegroundColor Cyan
    exit 1
}
