# Responsibility: reject commits that fail static checks.
& pnpm lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& pnpm typecheck
exit $LASTEXITCODE
