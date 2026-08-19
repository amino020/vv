param([switch]$NoOpen)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$port = 8791
$envFile = Join-Path $workspace '.env'
if (Test-Path -LiteralPath $envFile) {
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^PORT=\d+$' } | Select-Object -First 1
  if ($line) { $port = [int]($line -replace '^PORT=', '') }
}

$healthUrl = "http://127.0.0.1:$port/health"
try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  if ($health.service -eq 'bot-vip-classique') {
    Write-Host "Bot VIP déjà en ligne sur http://127.0.0.1:$port/"
    if (-not $NoOpen) { Start-Process "http://127.0.0.1:$port/" }
    exit 0
  }
} catch {}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { throw "Le port $port est déjà utilisé par une autre application." }

$node = (Get-Command node.exe -ErrorAction Stop).Source
$stdout = Join-Path $workspace 'data\service.stdout.log'
$stderr = Join-Path $workspace 'data\service.stderr.log'
$process = Start-Process -FilePath $node -ArgumentList 'src/index.js' -WorkingDirectory $workspace `
  -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 80; $attempt++) {
  Start-Sleep -Milliseconds 250
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.service -eq 'bot-vip-classique') {
      Write-Host "Bot VIP en ligne sur http://127.0.0.1:$port/ (PID $($process.Id))."
      if (-not $NoOpen) { Start-Process "http://127.0.0.1:$port/" }
      exit 0
    }
  } catch {}
}

throw "Le bot n'a pas démarré. Consulte data\service.stderr.log."
