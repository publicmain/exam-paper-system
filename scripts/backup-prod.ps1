# backup-prod.ps1 — Task Scheduler wrapper for the daily prod backup.
#
# Resolves the prod DB public URL via the Railway CLI (auth'd by the
# account token in .env.local), then runs the Prisma logical backup, which
# writes a gzipped snapshot into the OneDrive folder (off-site sync) and
# rotates old copies. Appends to backups\backup.log and exits non-zero on
# failure so Task Scheduler records "last run result" as an error.
#
# Register (run once, as the user; adjust time as you like):
#   schtasks /Create /TN "ExamPaperBackup" /SC DAILY /ST 12:30 ^
#     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\yaoke\Projects\exam-paper-system\scripts\backup-prod.ps1"
#   schtasks /Run /TN "ExamPaperBackup"      # test it immediately

$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj
$logDir = Join-Path $proj 'backups'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'backup.log'
function Log($m) { "[$(Get-Date -Format o)] $m" | Tee-Object -FilePath $log -Append }

try {
  $tl = Select-String -Path (Join-Path $proj '.env.local') -Pattern '^RAILWAY_API_TOKEN=' | Select-Object -First 1
  if (-not $tl) { throw 'RAILWAY_API_TOKEN not found in .env.local' }
  $env:RAILWAY_API_TOKEN = ($tl.Line -replace '^RAILWAY_API_TOKEN=', '').Trim()

  $vars = railway variables --service Postgres --json | ConvertFrom-Json
  if (-not $vars.DATABASE_PUBLIC_URL) { throw 'could not resolve DATABASE_PUBLIC_URL from Railway' }
  $env:DATABASE_URL = $vars.DATABASE_PUBLIC_URL

  $out = node scripts/backup-prod.mjs 2>&1
  $out | Tee-Object -FilePath $log -Append | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "backup-prod.mjs exited $LASTEXITCODE" }
  Log 'wrapper OK'
} catch {
  Log "wrapper FAILED: $_"
  exit 1
}
