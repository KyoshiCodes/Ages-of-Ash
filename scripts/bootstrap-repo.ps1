# Responsibility: explicitly publish this tree to its canonical repository; fail on every git error.
$ErrorActionPreference = 'Stop'
function Git-Step { & git @args; if ($LASTEXITCODE -ne 0) { throw "git failed: $args" } }
if (-not (Test-Path .git)) { Git-Step init -b main }
$remotes = & git remote
if ($remotes -contains 'origin') {
  $origin = & git remote get-url origin
  if ($origin -ne 'https://github.com/KyoshiCodes/Ages-of-Ash.git') { throw "Unexpected origin: $origin. Resolve manually to avoid publishing the wrong repository." }
} else { Git-Step remote add origin https://github.com/KyoshiCodes/Ages-of-Ash.git }
Git-Step fetch origin
& pnpm install
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
& pnpm verify
if ($LASTEXITCODE -ne 0) { throw 'Verification failed' }
& git show-ref --verify --quiet refs/heads/main
if ($LASTEXITCODE -eq 0) { Git-Step checkout main } else {
  & git show-ref --verify --quiet refs/remotes/origin/main
  if ($LASTEXITCODE -eq 0) { throw 'Canonical main already has commits. Clone it first and copy these files into that checkout so remote history is preserved.' }
  Git-Step symbolic-ref HEAD refs/heads/main
}
Git-Step add .
& git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { Git-Step commit -m 'feat: establish Ages of Ash playable foundation' }
& git show-ref --verify --quiet refs/heads/develop
if ($LASTEXITCODE -ne 0) { Git-Step branch develop main }
Git-Step push -u origin main
Git-Step push -u origin develop
Write-Host 'Next: GitHub Settings > Branches > protect main and develop; require CI and one review; disallow force pushes.'
Write-Host 'No deployment secrets are needed by CI. Manual deployment: deploy/README.md. For future deployment automation configure OCI_HOST, OCI_USER and OCI_SSH_KEY in Actions secrets.'
