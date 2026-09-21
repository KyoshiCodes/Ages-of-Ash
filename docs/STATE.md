# Living state — 2026-09-21

Workspace: `C:\Projects\Ages of Ash`. Canonical remote: https://github.com/KyoshiCodes/Ages-of-Ash. The local tree is not yet a Git checkout and bootstrap/push has not been executed. Prisma/client/adapter/CLI remain exactly **7.10.0**.

## Implemented

The original playable MMO loop remains, with the B0–B6 expansion: validated JSON content/balance catalog and seed; three-second cautious/bold operations; deterministic capped offline catch-up and welcome-back Ember Ledger report; auditable/forgeable/redactable gameplay ledger backed by immutable audit; contacts with loyalty, history, refusal, defection and rehire; four-node adjacency/supply income; idle faction pressure; mastery-based Ash Cycle; lore/material badges; daily/weekly/event hooks; layered parchment/brass desk, SVG family, shared motion preferences; optional lazy R3F map/relic inspection and original streamed Opus; server telemetry and retention CLI. New systems have unit, database and browser coverage.

Content: 12 standard operations, 4 crew operations, 12 items, 4 contacts, 4 supply nodes, 5 lore fragments and 4 badges. Read RETENTION for exact rules, ART_DIRECTION for tone/tokens and PERFORMANCE for measured versus unverified targets.

## Verified locally

- `pnpm verify`: TypeScript, ESLint, 21 unit tests and production build, including the <400 KiB initial-JS gate.
- Native EDB PostgreSQL 18.6, SCRAM, isolated loopback port 55432; additive migration applied, seed repeated; Prisma drift comparison reports **No difference detected**.
- Three integration cases cover concurrent operation start/settlement, purchases, bounty/boss claims, offline reports, ledger actions, supply, pressure, Ash Cycle and telemetry. Duplicate settlement records exactly one prestige event.
- Four real Chromium journeys cover the original core loop, guest upgrade/live updates, offline/ledger/supply/weekly/faction/cycle/codex, plus optional media loading, reduced-motion and zero-volume persistence. API, worker and PostgreSQL are real.
- Production initial JS is about **165 KiB gzip**. Throttled signed-out shell checks were under one second at 4 Mbps/80 ms with no eager 3D/audio; exact latest timing is in test-results/performance.json. Styleguide screenshots at 390/1440 px and the phone codex were inspected.
- A deterministic earned-resource simulation reaches first prestige within 4–6 hours; fragmented worker ticks match a single 30-hour catch-up exactly.
- `pnpm analytics` executes against the real test schema; synthetic cohorts are not real retention evidence.

## Environment and delivery

The normal Windows PostgreSQL service and psql PATH setup are still absent. `.env` still targets the normal localhost:5432 application database. Follow SETUP for the durable service. `scripts/test-native-db.ps1` uses the ignored official native archive/cluster, tests on 55432 and stops it by default; it never changes the system service. Use **pnpm run doctor** because pnpm 12 reserves its built-in doctor command.

SOURCEBOOK.md contains the generated full file tree and complete sources/lockfile; PNG and Opus assets are complete base64. Regenerate with `pnpm exec tsx scripts/sourcebook.ts`. Secrets, .local, installed dependencies, test output and builds are excluded. `.generated/Ages-of-Ash.zip` is a source delivery archive.

## Known limits and unverified work

No core retention path is stubbed. Physical integrated-GPU 60 fps, physical Android, authenticated deployed meaningful paint, hosted CI, publishing, OCI ARM64 deployment and backup restore remain unverified. The production shell timing is a desktop Chromium measurement, not a hardware FPS claim. Optional inspection currently emits an upstream Three.Clock deprecation warning. Windows command dispatch still emits Node DEP0190 for trusted project commands.

Scope remains a small content catalog, one pressure faction and a four-node graph. Players/orders/boards use bounded first pages; worker visits all players; receipts/audits/telemetry need measured retention/partition strategy. Public moderation, email verification/recovery, administration, commercial cosmetics, large content volumes and actual player retention studies remain release work. Deployment now includes a brief service pause during seed to protect save compatibility; it is not zero downtime.

// TODO(agent): Install/configure the durable native PostgreSQL 18 service and psql PATH; rerun pnpm run doctor and pnpm setup:db.
// TODO(agent): Profile physical integrated graphics and Android at 60 Hz, then measure authenticated cold 4 Mbps paint against the deployed API.
// TODO(agent): Provision OCI ARM64, verify both network gates and TLS/native modules, and rehearse backup restore into an isolated database.
// TODO(agent): Add moderation/report/ban and email verification/password recovery before public registration.
// TODO(agent): Load-test 50–100 actions/sec, add activity-aware tick batches, pagination and measured audit/receipt/telemetry retention.
// TODO(agent): Complete screen-reader/keyboard/PWA audit and 30-day multi-schedule economy simulation.

## Exact next three actions

1. Follow docs/SETUP.md to install the native PG18 service, configure `.env`, then run `pnpm run doctor`, `pnpm setup:db`, `pnpm dev` and play at http://localhost:5173.
2. Re-run `pnpm verify`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:performance` against the intended test environment; use scripts/bootstrap-repo.ps1 to publish the canonical repository and enable branch protection.
3. Run the physical-device and OCI release gates in PERFORMANCE/HANDOFF/deploy documentation before public launch; preserve the existing server-authoritative rules and exact Prisma pin.
