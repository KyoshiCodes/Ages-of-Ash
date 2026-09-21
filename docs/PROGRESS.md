# Append-only build log

## 2026-09-20 — Phase 0 / workspace

What/why: authored README first, native Windows preflight, explicit safe repair mode, role/database bootstrap, environment template, LF policy, workspace pins and debugging configuration. Files: README.md, scripts/doctor.ts, setup-db.ts, process.ts, package.json, pnpm-workspace.yaml, .vscode, docs/SETUP.md. Verification: registry versions checked; dependencies installed; doctor reports actual missing system PostgreSQL. Confidence: high for executed native checks. Open question: installed service setup remains user-environment work. Discovery: pnpm 12 reserves doctor; use pnpm run doctor.

## 2026-09-20 — Typed gamedata and pure rules

What/why: four original eras, eight operations, twelve items and centralized progression/economy/combat tuning; deterministic server reducer for all v1 actions. Files: packages/gamedata, packages/engine, tests/unit.test.ts. Tests: 11 unit cases covering clocks, holdings, gear budget, bounded combat, farming protection, loot, invalid rewards, injected fields, leveling/skills and ascension gear locks. Confidence: high for unit-covered invariants; balance targets are not playtest measurements. Open question: expand simulations and content volume.

## 2026-09-20 — Persistence and transactional settlement

What/why: Prisma 7 schema/migration/seed; ordered actor/target locking, nonce receipts, audit entries, bounty escrow, shared boss contribution claims. Files: packages/database, apps/api/src/service.ts, tests/integration.test.ts. Tests: real native PostgreSQL 18.6 migration and repeat seed, schema diff with no drift, two concurrency integration cases. Found/fixed: pg_notify void deserialization required a text cast. Confidence: high for tested settlement; more adversarial coverage needed.

## 2026-09-20 — Queue, clocks and live infrastructure

What/why: CacheStore/QueueDriver/PubSub boundaries, pg-boss worker, expiry-indexed sessions and rate buckets, minutely resource/income/rank updates, reconnecting notification listener. Files: packages/infrastructure, apps/worker, API live endpoint. Tests: real worker boot during Chromium tests, live update between tabs, tick math unit tests. Confidence: medium-high. Open questions: load ceiling, operational metrics and audit growth remain unmeasured.

## 2026-09-20 — Identity, social and API boundaries

What/why: argon2id accounts, guest upgrade, hashed opaque session cookies, Origin checks, rate limiting, strict Zod requests, guilds, war declarations, chat/mail, friend/rival lists and region controller query. Files: apps/api/src/index.ts and Prisma social models. Tests: registration and guest-upgrade browser flows; nonce trust-boundary unit/integration checks. Confidence: medium; exhaustive cross-channel and social authorization tests deferred. Open questions: moderation, recovery and verification before public launch.

## 2026-09-20 — Mobile dossier, PWA and art-free presentation

What/why: full playable UI, four-era palettes, semantic controls, mastery/resource bars, territory view, social UI, styleguide, manifest/offline service worker and generated SVG/PNG icons. Files: apps/web, scripts/generate-icons.ts, check-ui.ts, tests/e2e/core.spec.ts. Tests: two real Chromium core-loop/live/upgrade cases; 1440/390px styleguide overflow and runtime checks; inspected desktop/phone screenshots. Build: about 415 kB JS /127 kB compressed plus 13 kB CSS. Confidence: high for tested Chrome UI; physical Android installability remains unverified.

## 2026-09-20 — Delivery and operations

What/why: hosted CI with PG18, Conventional Commit hooks, safe canonical bootstrap script, OCI native provisioning/release/backup services, original lore/formulas/roadmap and agent-specific briefs. Files: .github, .husky, deploy, docs, scripts/sourcebook.ts. Verification: local static checks/build pass; deployment scripts reviewed but no OCI access was exercised. Confidence: medium for unexecuted hosting scripts. Open questions: actual ARM64 package availability, TLS/network gates, restore rehearsal and branch protection.

## 2026-09-20 — Native verification environment

What/why: missing system PostgreSQL would have left integration unverified; downloaded the official EDB 18.6 Windows archive into ignored .local and ran a separate SCRAM cluster on 55432. Files: scripts/test-native-db.ps1, ignored local test artifacts. Tests: migration, schema parity, concurrency, real API/worker and Chromium passed. No system service or default app credentials were silently installed or changed. Confidence: high for executed tests; durable workstation setup still follows SETUP.

## 2026-09-21 — Validated content and art direction

What/why: established the desk palette/type/spacing/glow/tone bible, extracted balance and curve coefficients to JSON, validated cross-references and added one chain entry per era. Files: docs/ART_DIRECTION.md, gamedata/src/{content,chronicle,balance}.json, schema.ts, balance-schema.ts, index.ts, scripts/validate-content.ts; ContentDefinition schema/migration/seed. Tests: malformed references, build validation, seeded catalog integration. Confidence: high for current tables; hundreds of entries remain authored-content work.

## 2026-09-21 — Offline report and dual-tempo operations

What/why: separate activity/tick anchors, 8h full + 16h quarter credit, rational holding carry, persistent recap and reserved-energy timed settlement. Files: engine/chronicle*.ts, index.ts, api/service.ts, web/desk.tsx; unit/integration/e2e suites. Tests: irregular partitions equal lazy catch-up, caps/repeat timestamps, early resolution rejection, replay, loot, hidden-read inactivity and recap flow. Confidence: high for exercised boundaries; randomized schedule coverage can grow.

## 2026-09-21 — Literal ledger and opinionated contacts

What/why: audit/forge/redact costs and consequences, immutable relational audit, loyalty/refusal/defection/rehire, bounded memories and history operations. Files: engine/chronicle.ts, API game/social transactions, web/desk.tsx, chronicle.json. Tests: forgery fines, redaction, loyalty refusal/recovery, unique operation and browser ledger actions. Confidence: high for tested paths; adversarial economic recycling review remains useful.

## 2026-09-21 — Spatial holdings and persistent faction

What/why: reciprocal owned adjacency, purchased supply links, escalating Glasswrit Office pressure and stamina suppression. Files: gamedata/chronicle.json, engine/chronicle.ts, presentation.ts, web/desk.tsx. Tests: invalid links rejected, linked income, integer carry across pressure changes, database persistence and browser map/suppression. Confidence: high for four-node map; richer logistics/content is deferred.

## 2026-09-21 — Ash Cycle and session hooks

What/why: 60 mastery/four-hour reset, permanent ash, persistent assets/history, lore and material badges, weekly crew contract alongside existing daily/event hooks. Files: chronicle engine/data, presentation projection and desk/main UI. Tests: earned-resource 4–6h simulation, gate/reset invariants, one-time weekly rewards, duplicate prestige telemetry and browser codex unlock. Confidence: high for rules; human retention and month-scale balance unmeasured.

## 2026-09-21 — Desk motion, optional media and performance

What/why: paper/brass/wax CSS, readable locked badges, one SVG family, number roll-ups and clock sweeps, global reduced-motion/speed, demand-rendered lazy R3F inspection, original generated Opus with gesture gating. Files: apps/web/src/desk*, main.tsx, public/audio, scripts/generate-audio.ts, performance-budget.ts, check-performance.ts. Tests: all four browser journeys, lazy media requests, zero-volume persistence, build graph budget and 390/1440 overflow. Initial JS ~165 KiB gzip; signed-out cold 4 Mbps shell under one second in local Chromium. Confidence: high for browser functionality; physical 60 fps/Android still unverified.

## 2026-09-21 — Instrumentation, release compatibility and handoff

What/why: transactional PlaySession/TelemetryEvent, operator retention CLI, scoped live invalidations to avoid unnecessary rate-limit pressure, locked legacy seed and deployment seed maintenance window. Files: schema/additive migration, telemetry.ts, analytics.ts, seed.ts, service.ts, main.tsx, deploy/release.mjs, docs. Tests: three database cases, schema parity, analytics query execution, full verify and four browser journeys. Confidence: high for local verification; hosted CI/OCI and actual player retention not claimed. Sourcebook/archive regenerated with binary Opus support.
