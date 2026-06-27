$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$web = Join-Path $root "apps\web"
$out = Join-Path $root "apps\web\next-start.log"
$err = Join-Path $root "apps\web\next-start.err.log"
$buildId = Join-Path $root "apps\web\.next\BUILD_ID"
$node = "C:\Program Files\nodejs\node.exe"
$next = Join-Path $web "node_modules\next\dist\bin\next"

Set-Location $web

"BBA App web server started at $(Get-Date -Format s)" | Out-File -LiteralPath $out -Encoding UTF8
"" | Out-File -LiteralPath $err -Encoding UTF8

$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId -and $processId -ne 0) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $buildId)) {
  "Production build not found. Running next build..." | Out-File -LiteralPath $out -Append -Encoding UTF8
  & $node $next build >> $out 2>> $err
}

& $node $next start --hostname 127.0.0.1 --port 3000 >> $out 2>> $err
