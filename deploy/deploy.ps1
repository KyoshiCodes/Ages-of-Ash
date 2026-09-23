# Responsibility: execute the release script from the exact reviewed source SHA; migration remains a separate switch.
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_.@-]+$')][string]$RemoteHost,
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit,
  [switch]$ApproveMigrations,
  [switch]$AllowCodeRollback
)
$ErrorActionPreference = 'Stop'
$source = '/srv/ages/source'
& ssh $RemoteHost sudo -u ages-release git -C $source fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch the reviewed source' }
& ssh $RemoteHost sudo -u ages-release git -C $source merge-base --is-ancestor $Commit origin/main
if ($LASTEXITCODE -ne 0) { throw 'Reviewed commit is not on origin/main' }
& ssh $RemoteHost sudo -u ages-release git -C $source checkout --detach $Commit
if ($LASTEXITCODE -ne 0) { throw 'Could not select the exact reviewed release script' }
$releaseArgs = @('sudo','node',"$source/deploy/release.mjs","--commit=$Commit")
if ($ApproveMigrations) { $releaseArgs += '--approve-migrations' }
if ($AllowCodeRollback) { $releaseArgs += '--allow-code-rollback' }
& ssh $RemoteHost @releaseArgs
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect the sanitized remote journal' }
