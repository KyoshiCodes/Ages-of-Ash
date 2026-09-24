# Living state — 2026-09-23

Workspace: `C:\Projects\Ages of Ash`; canonical remote: https://github.com/KyoshiCodes/Ages-of-Ash. Prisma CLI, client and adapter remain pinned to **7.10.0**. The playable Ember Ledger expansion remains: timed operations, offline catch-up/report, crew histories, supply graph, faction pressure, Ash Cycle, optional lazy 3D/audio and server-side telemetry.

## Regional A1 quota preflight argument — 2026-09-23

The read-only regional A1 core quota command now omits availability-domain for standard-a1-core-regional-count. Selected-AD compute shape discovery still includes availability-domain, and the quota get call still uses the approved child staging compartment, compute service, limit name and region. The intake and runbook identify this quota as regional; quotaNeeded remains the available-quota threshold and ocpus remains the per-VM allocation. Native Windows pnpm verify:full passed on disposable PostgreSQL 18.6 with Prisma 7.10.0: 45 unit (16 staging), 6 integration, 5 E2E, backup/restore/refusal, typecheck, lint, build and 165.3 KiB gzip initial JS. No OCI command or live plan was run, so the real CLI outcome remains unverified.

## Local staging-report label clarification — 2026-09-23

The private-no-dns report now displays the planned 1 OCPU / 6 GiB A1 VM and 50 GiB boot disk separately from the required available A1 core quota threshold of 2. It labels releaseCommit as a reviewed/pinned release baseline, which may differ from the checkout generating the report. No quota comparison, TENANCY_ROOT guard, private exposure rule, OCI call path, or deployment behavior changed. A temporary ignored-intake copy rendered offline with no OCIDs; it and its report were removed. Native Windows pnpm verify:full passed 44 unit (15 staging), 6 integration and 5 E2E tests, backup/restore/refusal, typecheck, lint, build and 165.3 KiB gzip initial JS. No live OCI preflight or cloud action ran for this clarity fix.

## Explicit tenancy-root deny for staging — 2026-09-23

The first private staging intake now supports literal TENANCY_ROOT in productionDenyIds. Validation requires that sentinel, resolves it only from the existing tenancyId in memory, rejects tenancy-root and separately deny-listed production targets, and rejects production/root workload tokens in staging resource targets. Live read-only OCI inspection requires the selected ages-staging compartment to be a direct child of the tenancy root. Both private and public templates use the sentinel; extra dedicated production-compartment OCIDs remain supported only in ignored operator intake. Reports name the convention without printing OCIDs. No provisioning, host, release, recovery or other OCI action was performed.

The ignored operator intake remains blocked on one field in its original form. A temporary copy changing only productionDenyIds[0] to TENANCY_ROOT passed offline static validation; the report said private-no-dns and OCI UNVERIFIED. The copy and report were removed. This proves only static intake readiness, not cloud identity, quota, cost, IAM scope or authorization to run deployment/recovery commands. Native Windows pnpm verify:full passed on disposable PostgreSQL 18.6 with Prisma 7.10.0: three migrations, repeat seed, native backup/restore/populated-target refusal, 44 unit (15 staging), 6 integration and 5 Playwright E2E tests, typecheck, lint, build, and 165.3 KiB gzip initial JavaScript under the 400 KiB budget. Headless 4 Mbps/80 ms signed-out shell was ready in 824 ms, first paint 296 ms, FCP 712 ms, with zero initial media requests. Hosted Release foundation run 35943604374 passed for exact commit 27e6be65eee2c933d4bbc5bbb8f08ad5fa7d73a5 with PostgreSQL 18.6 clients, backup/restore/refusal, 44 unit, 6 integration and 5 E2E tests, and the 165.3 KiB gzip budget.

## Private-no-dns blocked-report correction — 2026-09-23

At baseline 46d28b0, a private intake with unresolved fields stayed BLOCKED, but its report lost a valid rehearsalMode because full schema parsing returned no executable intake. It then printed INVALID/UNRESOLVED and the public TLS/gameplay/WebSocket next step. Validation now carries only a separately checked mode to blocked reports; it still withholds unvalidated targets and skips OCI calls. Private reports mark public DNS, TLS/ACME, internet browser flow, WebSocket validation, alert delivery and off-host backup deferred/unverified. Public mode retains its owned-DNS/TLS route. Duplicate placeholder/schema diagnostics are collapsed without changing validation. At that time, the ignored private intake was BLOCKED on six distinct unresolved fields; its report identified private-no-dns and gave only private guidance. No OCI action was performed.

Native Windows full acceptance passed on disposable PostgreSQL 18.6 with Prisma 7.10.0: 42 unit (13 staging), 6 integration and 5 Playwright E2E tests; backup, empty-target restore, populated-target refusal, typecheck, lint, build and 165.3 KiB gzip initial-JS budget passed. Hosted Release foundation run 35915013958 passed for exact commit a74cdfca719ba3bbc4422711440bcd07a7a70853 with 42 unit, 6 integration and 5 E2E tests.

## Private zero-cost OCI rehearsal mode — planning and validation only

Baseline commit 095e58e passed hosted Release foundation run 35813584157: disposable PostgreSQL 18.6 service and clients, migration/seed repeat, backup/restore/refusal parity, 36 unit, 6 integration and 5 E2E tests, bundle/performance gates and artifact upload. This milestone adds an explicit private-no-dns intake mode and keeps the former public route as separate public-dns mode. Default private intake uses JSON null hostname/zoneName, no public IP or ingress, PostgreSQL loopback and OCI Bastion administration; validation rejects placeholders, production identifiers and compute above the A1 2 OCPU/12 GiB/50 GiB boot plan. The private read-only plan omits OCI DNS and public NS calls and labels DNS/ACME/TLS/public browser/WebSocket/alerts and off-host backup deferred. An operator must confirm current OCI Console Always Free eligibility and a complete $0 planned estimate before any future creation; no cost guarantee is made. The public-only host provisioner now requires an explicit --public-dns-mode gate because it opens host 80/443; it must not be used in private mode. No OCI resource, DNS, IAM, bucket, key, firewall, host or application was changed here.

On native Windows, 11 focused staging tests passed; the synthetic private offline plan exited 0 with STATIC INPUT VALID; OCI UNVERIFIED, and the placeholder template exited 1 BLOCKED. Its report named all public/private limits and omitted OCIDs/credentials. Full disposable acceptance passed again (40 unit, 6 integration, 5 E2E; details below). Live OCI preflight, private host preparation, actual shape capacity, cost, Bastion/network/firewall denials, TLS, off-host encrypted backup/retrieval, alerts, RTO/RPO and physical-device/accessibility remain unverified. Public-dns mode retains the owned-domain, public Caddy/HTTPS plan for later independent approval.

## Release foundation now present

`pnpm setup:db` now only creates/probes the role and database; generation, migration and seed are separate explicit commands. `pnpm run doctor` is read-only by default and checks migration history, canonical content and generated client/schema parity. `--fix` repairs tools/client only; `--fix --database` is the explicit database opt-in. `pnpm verify:fast` is the typecheck/lint/unit/build gate. `pnpm verify:full` creates a unique disposable PostgreSQL 18 database, proves empty schema, generates the Prisma client, deploys three migrations, seeds twice without changing player state, drills a separate read-only backup role and native backup/restore/refusal, runs fast, integration, E2E and performance, and removes only its own role/database/cluster. It never targets the configured persistent DATABASE_URL. Hosted CI uses an ephemeral PostgreSQL 18.6 service and the same full gate. Run 35779531846 for commit 129831d failed at 00-bootstrap-probe, before migrations or tests: the launcher treated the npm_execpath pnpm.cjs ELF shim as a Node script. The repair invokes pnpm as a native executable with shell:false, adds an existing-ELF regression fixture, and updates Node 24 action pins and PostgreSQL health checks. Replacement run 35795756821 for commit 550ae6f passed 27 unit, 6 integration, 5 E2E and the bundle gate, but the hosted Linux path skipped native dump/restore.

Production design separates migration, API and worker database roles. The release script requires an exact reviewed commit and an explicit `--approve-migrations` to run `prisma migrate deploy`; runtime processes do not migrate. Readiness covers database, migration, catalog, world and worker heartbeat. JSON logs include correlation IDs, route/status/latency and bounded job health; they omit URLs, secrets, personal data and full saves. Operator metrics are loopback-only with a token. Analytics collection defaults off; operator aggregate query and dry-run 30-day cleanup are explicit. Native backup and empty-target restore tools exist, and the disposable Windows acceptance run exercised them.

## Backup/restore parity verified on Windows and hosted Linux

The new acceptance path requires PostgreSQL 18 client tools on both platforms and always runs a custom-format dump, empty-target restore and populated-target refusal before gameplay tests. It compares schema, migration records, canonical content, player state, PlaySession, TelemetryEvent and OperationalStatus, then removes generated roles, databases and dump files. The hosted job installs pinned PostgreSQL 18.6 clients from the signed PGDG noble source; the first hosted parity run (35797835277) stopped at client installation because a pool-listed package revision was absent from the active PGDG index. The corrected run 35798015112 passed all stages with pg_dump, pg_restore and psql 18.6; 05a-backup, 05b-restore and 05c-restore-refusal were recorded, along with schema/data parity and artifact upload. Dumps stay under ignored .local, outside uploaded failure artifacts; the hosted artifact inspection found 23 files and zero dumps. OCI staging and off-host recovery remain unverified.

## Latest local verification — private-mode change

Native Windows pnpm verify:full passed on a fresh disposable PostgreSQL 18.6 cluster with PostgreSQL 18.6 clients and Prisma 7.10.0. Three migrations applied; repeat deploy found none pending and repeat seed completed. The read-only backup role, custom-format dump, empty-target restore, populated-target refusal and schema/content/player/session/telemetry/operational parity all passed. Typecheck, lint, production build, bundle budget, **40 unit**, **6 integration** and **5 Playwright E2E** tests passed. Initial JS was **165.3 KiB gzip / 400 KiB**; optional 3D/audio remained separate. Emulated 4 Mbps/80 ms signed-out shell was ready in **891 ms**, first paint **272 ms**, FCP **672 ms**, with zero initial media requests. Generated database, roles and dump files were disposed. These measurements do not certify a physical device or OCI deployment. The focused private/public suite contains 11 of the 40 unit tests.

The configured persistent local `ages` database was intentionally left unchanged. Read-only doctor reports `20260922000000_release_foundation` pending and exits 1; the operator can review and explicitly run `pnpm db:deploy` and `pnpm db:seed` when ready.

## Unverified and known limits

OCI provision/release, TLS and ARM64 binaries, off-host encrypted backups, operator alert delivery, rollback and production data recovery have not been executed here. Physical Android/integrated-GPU 60 fps, screen-reader audit and authenticated hosted first paint remain unverified. The disposable test proves local migration/seed/restore behavior, not production credentials or network configuration. Content depth, moderation, email recovery and load ceiling remain future milestones. Review `deploy/README.md`, `docs/RECOVERY.md` and `docs/DEVICE_VALIDATION.md` before release.

## Exact next three actions

1. Operator privately completes private-no-dns intake and named ownership, then runs static/live **read-only** preflight/plan and checks current OCI Console Always Free eligibility and a $0 planned estimate; aborts on any unknown cost or capacity.
2. Security/IAM and staging operators review a separate administration-only private-host/egress procedure and denied-access plan before requesting any creation approval. Preserve distinct Unix/DB identities, explicit migration approval and empty-target restore refusal; do not run the public-only provisioner.
3. Backup/key/recovery owners select a free or approved remote backup target and prove encrypted retrieval/isolated restore before claiming off-host recovery. Public DNS/TLS/browser/WebSocket and physical-device/accessibility gates remain separate future work.

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
