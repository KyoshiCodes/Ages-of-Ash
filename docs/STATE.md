# Living state — 2026-09-22

Workspace: `C:\Projects\Ages of Ash`; canonical remote: https://github.com/KyoshiCodes/Ages-of-Ash. Prisma CLI, client and adapter remain pinned to **7.10.0**. The playable Ember Ledger expansion remains: timed operations, offline catch-up/report, crew histories, supply graph, faction pressure, Ash Cycle, optional lazy 3D/audio and server-side telemetry.

## Release foundation now present

`pnpm setup:db` now only creates/probes the role and database; generation, migration and seed are separate explicit commands. `pnpm run doctor` is read-only by default and checks migration history, canonical content and generated client/schema parity. `--fix` repairs tools/client only; `--fix --database` is the explicit database opt-in. `pnpm verify:fast` is the typecheck/lint/unit/build gate. `pnpm verify:full` creates a unique disposable PostgreSQL 18 database, proves empty schema, generates the Prisma client, deploys three migrations, seeds twice without changing player state, drills a separate read-only backup role and native backup/restore/refusal, runs fast, integration, E2E and performance, and removes only its own role/database/cluster. It never targets the configured persistent DATABASE_URL. Hosted CI uses an ephemeral PostgreSQL 18.6 service and the same full gate; hosted CI has not yet been observed running on GitHub.

Production design separates migration, API and worker database roles. The release script requires an exact reviewed commit and an explicit `--approve-migrations` to run `prisma migrate deploy`; runtime processes do not migrate. Readiness covers database, migration, catalog, world and worker heartbeat. JSON logs include correlation IDs, route/status/latency and bounded job health; they omit URLs, secrets, personal data and full saves. Operator metrics are loopback-only with a token. Analytics collection defaults off; operator aggregate query and dry-run 30-day cleanup are explicit. Native backup and empty-target restore tools exist, and the disposable Windows acceptance run exercised them.

## Latest local verification

On native Windows with Node 24.21.0, pnpm 12.5.1 and PostgreSQL 18.6: `pnpm verify:full` passed from a fresh database. Three migrations applied; repeat deploy found none pending; repeat seed left existing player state unchanged. **25 unit, 6 integration and 5 Playwright E2E tests passed.** Typecheck, ESLint, production build and bundle gate passed. Initial JS was **165.3 KiB gzip / 400 KiB**; optional 3D/audio remained separate. Emulated 4 Mbps/80 ms signed-out shell was ready in **901 ms** with zero initial media requests. The backup/restore drill recovered the catalog and player state and refused a second restore into the nonempty database. Project child-process dispatch no longer emitted Node DEP0190. Playwright emitted unrelated `NO_COLOR`/`FORCE_COLOR` and upstream Three.Clock notices. Fastify now uses `LogController`; the final full rerun passed without its prior deprecation warning.

The configured persistent local `ages` database was intentionally left unchanged. Read-only doctor reports `20260922000000_release_foundation` pending and exits 1; the operator can review and explicitly run `pnpm db:deploy` and `pnpm db:seed` when ready.

## Unverified and known limits

OCI provision/release, GitHub-hosted CI, TLS and ARM64 binaries, off-host encrypted backups, operator alert delivery, rollback and production data recovery have not been executed here. Physical Android/integrated-GPU 60 fps, screen-reader audit and authenticated hosted first paint remain unverified. The disposable test proves local migration/seed/restore behavior, not production credentials or network configuration. Content depth, moderation, email recovery and load ceiling remain future milestones. Review `deploy/README.md`, `docs/RECOVERY.md` and `docs/DEVICE_VALIDATION.md` before release.

## Exact next three actions

1. Run the new CI workflow on a pull request and inspect its artifacts; confirm hosted Ubuntu service, browser and bundle gate results.
2. Provision OCI staging with separate DB identities; execute the explicit migration gate, TLS/network/readiness, off-host backup and timed restore rehearsal with named recovery owners.
3. Measure physical Windows integrated-graphics and Android traces, accessibility and authenticated 4 Mbps first paint, then resolve recorded issues before public registration.

The following independent result was supplied before this milestone and remains as historical evidence of the chronology. Its prior gaps are addressed or updated above.

## Historical independent local verification — 2026-09-21 (superseded by release-foundation run)

Environment:
- Windows build 26200.
- Node 24.21.0 via Volta.
- pnpm 12.5.1 via Volta.
- PostgreSQL 18.6, application role ages, SCRAM-SHA-256 host authentication.

Recovery performed:
- The local database initially lacked the committed chronicle migration.
- pnpm db:deploy applied 20260921000000_chronicle, creating PlaySession and TelemetryEvent.
- The migrated database initially had zero ContentDefinition records.
- pnpm db:seed completed successfully and installed canonical content.

Verified after migration and seed:
- pnpm install --frozen-lockfile: passed.
- pnpm run doctor: passed.
- pnpm verify: passed:
  - TypeScript typecheck;
  - ESLint;
  - 21 unit tests;
  - production build.
- pnpm test:integration: 3/3 passed.
- pnpm test:e2e: 4/4 passed.
- Initial JS build budget: 165.3 KiB gzip / 400 KiB, with optional 3D/audio emitted separately.

Important workflow:
pnpm install --frozen-lockfile
pnpm run doctor
pnpm db:deploy
pnpm db:seed
pnpm verify
pnpm test:integration
pnpm test:e2e

Not independently verified:
- OCI deployment.
- Production PostgreSQL/backup/restore procedures.
- CI using a clean ephemeral PostgreSQL database.
- Physical-device 60 fps.
- 4 Mbps sign-in-shell timing.
- Production observability, alerts, analytics-consent behavior, and incident runbooks.

Remaining improvement:
- Make pending migrations and missing canonical content explicit in doctor/setup output.
- Introduce a full verification command or CI workflow that migrates and seeds an empty disposable database before integration/E2E testing.
- Resolve the Node DEP0190 child-process shell warning.
