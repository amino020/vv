$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$port = 8791
$envFile = Join-Path $workspace '.env'
if (Test-Path -LiteralPath $envFile) {
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^PORT=\d+$' } | Select-Object -First 1
  if ($line) { $port = [int]($line -replace '^PORT=', '') }
}
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) { Write-Host 'Le bot VIP est déjà arrêté.'; exit 0 }
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
if (-not $process -or $process.Name -ine 'node.exe' -or $process.CommandLine -notmatch 'src[\\/]index\.js') {
  throw "Le port $port appartient à une autre application. Aucun processus n'a été arrêté."
}
Stop-Process -Id $listener.OwningProcess
Write-Host 'Bot VIP arrêté.'
