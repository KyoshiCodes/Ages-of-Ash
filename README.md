# Ages of Ash

A mobile-first, persistent-world syndicate RPG spanning four eras of the Ember Line. Native Windows development, PostgreSQL as the sole datastore, React DOM/CSS/SVG interface.

The Ember Ledger expansion adds timed risk choices, capped offline reports, opinionated crew, supply lines, faction clocks, playable forgery/auditing, living lore and the Ash Cycle. The desk includes optional lazy-loaded 3D inspections and original streamed audio; all gameplay remains available in 2D. Read [art direction](docs/ART_DIRECTION.md), [retention rules](docs/RETENTION.md) and [performance evidence](docs/PERFORMANCE.md).

## Ten-minute quickstart

Follow [Windows setup](docs/SETUP.md) first if PostgreSQL 18 is not installed.

```powershell
volta install node@24.21.0
volta install pnpm@12.5.1
Copy-Item .env.example .env
pnpm install
pnpm run doctor
pnpm setup:db
pnpm dev
```

Open http://localhost:5173. Create an account or enter as a guest, run Cinder Quay operations, spend skills, recruit crew, equip equipment, build a holding, duel the seeded sparring operator and challenge a boss. Use a second browser profile for two-player verification. Guest accounts can be upgraded in the account panel.

Choose an approach, start an operation, then select **Resolve operation** after its three-second clock. The first Ash Cycle needs 60 mastery and a four-hour-old ledger. Returning after two minutes opens a server-calculated recap. Existing installations should run `pnpm setup:db` to apply the additive migration and seed the validated content catalog. Prisma remains pinned at **7.10.0**.

```text
Browser React ── REST / WebSocket ── Fastify API
                                        │
                          Prisma + pg / row locks
                                        │
                                   PostgreSQL 18
                                 /       |       \
                            sessions   pg-boss   LISTEN/NOTIFY
                                         │             │
                                  Node worker       API fan-out
```

`pnpm verify` runs typecheck, lint, unit tests and builds. `pnpm test:integration` requires the configured database. `pnpm test:e2e` starts the three application processes and runs Chromium against that database.

Oracle deployment uses Ubuntu 24.04 ARM64, PostgreSQL, Caddy and two systemd services. See [deployment](deploy/README.md). Read [STATE](docs/STATE.md) for actual verification and release limitations before exposing a server publicly.

Source of truth: https://github.com/KyoshiCodes/Ages-of-Ash. `scripts/bootstrap-repo.ps1` initializes and publishes only when explicitly run.
