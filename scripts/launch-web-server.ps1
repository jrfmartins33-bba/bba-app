$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$web = Join-Path $root "apps\web"
$out = Join-Path $web "next-start.log"
$err = Join-Path $web "next-start.err.log"
$pidFile = Join-Path $web "next-start.pid"
$buildId = Join-Path $web ".next\BUILD_ID"
$node = "C:\Program Files\nodejs\node.exe"
$next = Join-Path $web "node_modules\next\dist\bin\next"

$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId -and $processId -ne 0) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $buildId)) {
  Push-Location $web
  try {
    & $node $next build
  } finally {
    Pop-Location
  }
}

"BBA App web server launched at $(Get-Date -Format s)" | Out-File -LiteralPath $out -Encoding UTF8
"" | Out-File -LiteralPath $err -Encoding UTF8

$arguments = "`"$next`" start --hostname 127.0.0.1 --port 3000"

$process = Start-Process `
  -FilePath $node `
  -ArgumentList $arguments `
  -WorkingDirectory $web `
  -WindowStyle Hidden `
  -RedirectStandardOutput $out `
  -RedirectStandardError $err `
  -PassThru

$process.Id | Out-File -LiteralPath $pidFile -Encoding ASCII
"Started BBA App at http://127.0.0.1:3000 with PID $($process.Id)"
