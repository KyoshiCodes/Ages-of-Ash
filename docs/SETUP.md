# Native Windows setup

`pnpm run doctor` is the repository preflight. pnpm 12 also has a built-in `pnpm doctor`; that command does not inspect this game's database.

1. Open PowerShell in `C:\Projects\Ages of Ash` on Windows 10 22H2+ or Windows 11. Keep at least 10 GB disk free and 4 GB RAM free. Install missing tools with `winget install -e --id Volta.Volta`, `winget install -e --id Git.Git`, and optionally `winget install -e --id GitHub.cli`. Reopen PowerShell.
2. Run `volta install node@24.21.0` and `volta install pnpm@12.5.1`. `Get-Command node,pnpm -All` should list Volta shims first. This repository pins those versions and Prisma **7.10.0**.
3. Run `winget install -e --id PostgreSQL.PostgreSQL.18`. Select the native server and command-line tools, use port 5432, and save the postgres administrator password privately. Update to PostgreSQL 18.6 or later in 18.x. Check `Get-Service *postgres*`. Add `C:\Program Files\PostgreSQL\18\bin` to your user PATH, then reopen PowerShell.
4. Clone `https://github.com/KyoshiCodes/Ages-of-Ash.git` if needed. In the checkout run `git config core.autocrlf false`; `.gitattributes` enforces LF.
5. Run `Copy-Item .env.example .env`. Set DATABASE_URL to a dedicated local application role/password. For first bootstrap only, set PG_ADMIN_URL to `postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/postgres`. Percent-encode special password characters. Keep `.env` out of Git. Remove PG_ADMIN_URL after bootstrap.
6. Run `pnpm install --frozen-lockfile`, then `pnpm run doctor`. Doctor is **read-only**: it reports missing tools, database access, pending/failed migrations, missing or stale canonical content, and a stale generated Prisma client. It does not initialize the database. Review its report, then run `pnpm setup:db` for a missing role/database, `pnpm db:generate`, `pnpm db:deploy`, and `pnpm db:seed` in that order. These explicit commands modify the configured database. Existing player saves survive repeat migration/seed; schema authors use a separate shadow database for `pnpm db:migrate`.
7. Run `pnpm run doctor` again and require a green database/content/client report. Run `pnpm exec playwright install chromium`. `pnpm verify:fast` checks typecheck, lint, unit tests, and production build. For an acceptance test from a **new, disposable PostgreSQL database**, run `pnpm verify:full`. On Windows it starts an isolated native PostgreSQL 18 cluster using `PG_BIN` or installed binaries, creates a random role/database, proves the database is empty, generates the client, migrates, seeds twice, runs fast verification, integration and Chromium E2E, performs a backup/restore drill, and cleans up only its own cluster. Its logs go to ignored `artifacts/release`. It never uses DATABASE_URL as a migration target. If using an external disposable server, set `VERIFY_ADMIN_URL` explicitly; never point that variable at a production server. `pnpm verify` is an alias of the fast check.
8. Run `pnpm dev`. At [http://localhost:5173](http://localhost:5173), you should see **Ages of Ash — The Ember Ledger**. Enter as a guest, run an operation, and see the server return the new XP, cash, mastery, and energy. Stop `pnpm dev` before the full verification run so test web servers can use ports 3000 and 5173.

Expected light-load RSS: PostgreSQL 150–350 MB, API 100–200 MB, worker 90–180 MB, Vite 150–350 MB, browser 200–500 MB. Compilation can briefly add 500 MB. These are estimates, not measurements.

| Symptom | Windows fix |
| --- | --- |
| Old server occupies 5432 | `Get-NetTCPConnection -LocalPort 5432` then `Get-Process -Id <PID>`; stop only the service you own or adjust the configured port. |
| `pg_hba.conf` rejects auth | Add scoped localhost IPv4/IPv6 `scram-sha-256` rules in the PG18 data directory, then reload the native service. |
| postgres password forgotten | Use an authorized administrator or the EDB local password recovery procedure; restore SCRAM immediately afterward. |
| `psql` missing | Add `C:\Program Files\PostgreSQL\18\bin` to user PATH and reopen PowerShell. |
| Wrong Node version | `Get-Command node -All`; put Volta shims before older Node installs, reopen PowerShell, run `volta pin node@24.21.0`. |
| `.ps1` blocked | Review the script; run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and `Unblock-File .\scripts\bootstrap-repo.ps1`. |
| Defender locks node_modules | Close dev processes, wait for scanning, inspect Protection History, then retry install. |
| EPERM or long paths | Keep checkout path short; administrator: `git config --system core.longpaths true`; `pnpm config set store-dir C:\pnpm-store`. |
| Prisma engine download fails | Check trusted proxy/CA and HTTPS access to Prisma downloads; retry `pnpm db:generate` without disabling TLS validation. |
| Stale generated client | `pnpm db:generate`, restart API/worker, rerun doctor. |
| Doctor reports pending migrations/content | Review migrations, then explicitly run `pnpm db:deploy` and `pnpm db:seed`; doctor itself only reports. |
| E2E port already occupied | Stop `pnpm dev`; inspect `Get-NetTCPConnection -LocalPort 3000,5173`. |

The test cluster can also use the official EDB native PG18 archive extracted at `.local/postgresql/pgsql`; the acceptance runner never downloads or installs system software. CI uses an ephemeral PostgreSQL 18.6 service on the hosted runner. VS Code recommendations are in `.vscode/extensions.json`.
