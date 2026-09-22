# Responsibility: send an exact reviewed release SHA to the native remote provisioner.
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_.@-]+$')][string]$RemoteHost,[Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit,[switch]$ApproveMigrations,[switch]$AllowCodeRollback)
$ErrorActionPreference = 'Stop'
$releaseArgs = @('sudo','node','/srv/ages/source/deploy/release.mjs',"--commit=$Commit")
if ($ApproveMigrations) { $releaseArgs += '--approve-migrations' }
if ($AllowCodeRollback) { $releaseArgs += '--allow-code-rollback' }
& ssh $RemoteHost @releaseArgs
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect the sanitized remote journal' }
