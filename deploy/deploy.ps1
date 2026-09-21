# Responsibility: launch native remote provisioning/release from Windows using OpenSSH.
param([Parameter(Mandatory=$true)][string]$RemoteHost)
$ErrorActionPreference = 'Stop'
& ssh $RemoteHost 'sudo node /srv/ages/source/deploy/release.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect remote journal' }
