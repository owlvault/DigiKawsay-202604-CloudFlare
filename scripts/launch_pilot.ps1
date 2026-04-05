# DigiKawsay Pilot Launcher v2
# Usage: .\scripts\launch_pilot.ps1
# Prerequisites: Docker Desktop running, .env file with TELEGRAM_BOT_TOKEN and GEMINI_API_KEY

param(
    [switch]$SkipBuild,
    [switch]$SkipNgrok,
    [int]$ChannelPort = 8001,
    [int]$AdminPort = 8002
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  DigiKawsay Pilot Launcher v2" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
try {
    docker info | Out-Null
    Write-Host "  ✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check .env
$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "  ✗ .env file not found at $envFile" -ForegroundColor Red
    Write-Host "    Create it with: TELEGRAM_BOT_TOKEN=... and GEMINI_API_KEY=..." -ForegroundColor Yellow
    exit 1
}

# Load .env
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
    }
}

$token = $env:TELEGRAM_BOT_TOKEN
$gemini = $env:GEMINI_API_KEY

if (-not $token) { Write-Host "  ✗ TELEGRAM_BOT_TOKEN not set in .env" -ForegroundColor Red; exit 1 }
if (-not $gemini) { Write-Host "  ✗ GEMINI_API_KEY not set in .env" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Environment variables loaded" -ForegroundColor Green

# 2. Build & Start Docker
Write-Host "`n[2/6] Starting Docker services..." -ForegroundColor Yellow
Set-Location $ProjectRoot

if ($SkipBuild) {
    docker-compose up -d
} else {
    docker-compose up -d --build
}

Write-Host "  ✓ Docker services started" -ForegroundColor Green

# 3. Wait for services to be healthy
Write-Host "`n[3/6] Waiting for services to be healthy..." -ForegroundColor Yellow

$maxWait = 120
$elapsed = 0
$ready = $false

while (-not $ready -and $elapsed -lt $maxWait) {
    Start-Sleep -Seconds 5
    $elapsed += 5
    
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$AdminPort/health" -TimeoutSec 3
        if ($health.status -eq "healthy") {
            $ready = $true
        }
    } catch {
        Write-Host "  ... waiting ($elapsed`s)" -ForegroundColor Gray
    }
}

if ($ready) {
    Write-Host "  ✓ All services healthy" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Services may not be fully ready. Check docker logs." -ForegroundColor Yellow
}

# 4. Start Ngrok
if (-not $SkipNgrok) {
    Write-Host "`n[4/6] Starting Ngrok tunnel..." -ForegroundColor Yellow
    
    # Check if ngrok is installed
    $ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokPath) {
        Write-Host "  ✗ ngrok not found in PATH. Install: https://ngrok.com/download" -ForegroundColor Red
        Write-Host "  You can skip this with -SkipNgrok and configure manually." -ForegroundColor Yellow
        exit 1
    }

    # Kill any existing ngrok
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

    # Start ngrok in background
    Start-Process ngrok -ArgumentList "http $ChannelPort" -WindowStyle Minimized
    Start-Sleep -Seconds 3

    # Get the public URL
    try {
        $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
        $ngrokUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" }).public_url
        
        if ($ngrokUrl) {
            Write-Host "  ✓ Ngrok tunnel: $ngrokUrl" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Could not detect ngrok URL. Check http://localhost:4040" -ForegroundColor Yellow
            $ngrokUrl = ""
        }
    } catch {
        Write-Host "  ⚠ Could not query ngrok API. Check http://localhost:4040" -ForegroundColor Yellow
        $ngrokUrl = ""
    }

    # 5. Set Telegram Webhook
    if ($ngrokUrl) {
        Write-Host "`n[5/6] Configuring Telegram Webhook..." -ForegroundColor Yellow
        $webhookUrl = "$ngrokUrl/webhook"
        $telegramApi = "https://api.telegram.org/bot$token/setWebhook?url=$webhookUrl"
        
        try {
            $result = Invoke-RestMethod -Uri $telegramApi -TimeoutSec 10
            if ($result.ok) {
                Write-Host "  ✓ Webhook configured: $webhookUrl" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Telegram error: $($result.description)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  ✗ Failed to set webhook: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n[4/6] Skipping Ngrok (manual setup required)" -ForegroundColor Gray
    Write-Host "`n[5/6] Skipping Webhook (manual setup required)" -ForegroundColor Gray
}

# 6. Summary
Write-Host "`n[6/6] Launch Complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  DigiKawsay is LIVE" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Control Panel: http://localhost:$AdminPort/admin" -ForegroundColor White
Write-Host "  Dashboard:     http://localhost:$AdminPort/dashboard" -ForegroundColor White
Write-Host "  Health:        http://localhost:$AdminPort/health" -ForegroundColor White
Write-Host "  Channel:       http://localhost:$ChannelPort/health" -ForegroundColor White
if ($ngrokUrl) {
    Write-Host "  Ngrok:         $ngrokUrl" -ForegroundColor White
}
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open the Control Panel" -ForegroundColor White
Write-Host "  2. Create a new pilot project with a seed prompt" -ForegroundColor White
Write-Host "  3. Register participants and share invite links" -ForegroundColor White
Write-Host "  4. Monitor conversations in the Wizard of Oz panel" -ForegroundColor White
Write-Host ""
Write-Host "  To stop: docker-compose down" -ForegroundColor Gray
Write-Host ""
