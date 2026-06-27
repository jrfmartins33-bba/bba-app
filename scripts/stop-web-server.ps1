$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId -and $processId -ne 0) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $root "apps\web\next-start.pid"

if (Test-Path -LiteralPath $pidFile) {
  $savedProcessId = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if ($savedProcessId) {
    Stop-Process -Id ([int]$savedProcessId) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
