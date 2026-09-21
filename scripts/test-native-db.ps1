# Responsibility: run verification against an isolated native EDB cluster, never the installed service.
param([string]$BinaryDirectory = '.local/postgresql/pgsql/bin', [switch]$KeepRunning)
$ErrorActionPreference = 'Stop'
$workspace = (Get-Location).Path
$data = Join-Path $workspace '.local/test-data'
$bin = (Resolve-Path $BinaryDirectory).Path
$passwordFile = Join-Path $workspace '.local/test-password'
function Run-Step([string]$Command, [string[]]$Arguments) { & $Command @Arguments; if ($LASTEXITCODE -ne 0) { throw "Failed: $Command" } }
if (-not (Test-Path $passwordFile)) { [System.IO.File]::WriteAllText($passwordFile, [Guid]::NewGuid().ToString('N')) }
$password = [System.IO.File]::ReadAllText($passwordFile).Trim()
if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) { Run-Step (Join-Path $bin 'initdb.exe') @('-D',$data,'-U','postgres','--auth=scram-sha-256','--encoding=UTF8','--locale=C',"--pwfile=$passwordFile") }
& (Join-Path $bin 'pg_ctl.exe') status -D $data
if ($LASTEXITCODE -ne 0) { Run-Step (Join-Path $bin 'pg_ctl.exe') @('start','-D',$data,'-l',(Join-Path $workspace '.local/postgres-test.log'),'-o','-p 55432 -h 127.0.0.1','-w') }
$env:PG_ADMIN_URL = "postgresql://postgres:$password@127.0.0.1:55432/postgres"
$env:DATABASE_URL = 'postgresql://ages_test:ages_test_local_only@127.0.0.1:55432/ages_test'
try {
  Run-Step 'pnpm' @('setup:db')
  Run-Step 'pnpm' @('test:integration')
  Run-Step 'pnpm' @('exec','tsx','scripts/reset-test-limits.ts')
  Run-Step 'pnpm' @('test:e2e')
} finally {
  if (-not $KeepRunning) { & (Join-Path $bin 'pg_ctl.exe') stop -D $data -m fast -w }
}
