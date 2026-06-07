# run-integration-tests.ps1
# Run all Integration Tests with Docker test environment
# Usage: .\run-integration-tests.ps1

param(
    [switch]$SkipSetup,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Setup logging
$logDir = Join-Path $PSScriptRoot "test-results"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "integration-test-$timestamp.log"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  INTEGRATION TESTS - Full System Testing" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Log file: $logFile" -ForegroundColor Gray
Write-Host ""

# Start Docker test environment
if (-not $SkipSetup) {
    Write-Host "Starting Docker test environment..." -ForegroundColor Yellow | Tee-Object -FilePath $logFile
    docker-compose -f docker-compose.test.yml up -d 2>&1 | Tee-Object -FilePath $logFile -Append
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start Docker test environment" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for services to be ready (10 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Write-Host "Docker test environment ready" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Skipping Docker setup (-SkipSetup flag)" -ForegroundColor Yellow
    Write-Host ""
}

# Check if npm dependencies are installed
$integrationTestsDir = Join-Path $PSScriptRoot "integration-tests"
$nodeModulesPath = Join-Path $integrationTestsDir "node_modules"

if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing test dependencies..." -ForegroundColor Yellow | Tee-Object -FilePath $logFile -Append
    Set-Location $integrationTestsDir
    npm install 2>&1 | Tee-Object -FilePath $logFile -Append
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        Set-Location $PSScriptRoot
        exit 1
    }
    
    Write-Host "Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Run integration tests
Write-Host "" | Tee-Object -FilePath $logFile -Append
Write-Host "Running Integration Tests..." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "" | Tee-Object -FilePath $logFile -Append

Set-Location $integrationTestsDir
$testStartTime = Get-Date

npm test 2>&1 | Tee-Object -FilePath $logFile -Append
$testExitCode = $LASTEXITCODE

$testEndTime = Get-Date
$testDuration = ($testEndTime - $testStartTime).TotalSeconds

Set-Location $PSScriptRoot

# Summary
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
if ($testExitCode -eq 0) {
    Write-Host "ALL INTEGRATION TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
}
Write-Host "Duration: $([math]::Round($testDuration, 2)) seconds" -ForegroundColor Gray
Write-Host "Log saved: $logFile" -ForegroundColor Gray
Write-Host ""

# Stop Docker test environment (unless KeepRunning flag is set)
if (-not $KeepRunning) {
    Write-Host "Stopping Docker test environment..." -ForegroundColor Yellow
    docker-compose -f docker-compose.test.yml down 2>&1 | Tee-Object -FilePath $logFile -Append
    Write-Host "Test environment stopped" -ForegroundColor Green
} else {
    Write-Host "Test environment still running (-KeepRunning flag)" -ForegroundColor Yellow
    Write-Host "   To stop: docker-compose -f docker-compose.test.yml down" -ForegroundColor Gray
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Test run completed at $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

exit $testExitCode
