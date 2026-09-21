# Ready-to-paste refinement prompts

All prompts below additionally require Prisma **7.10.0 exactly**. Read RETENTION.md, PERFORMANCE.md and ART_DIRECTION.md; preserve the implemented B0–B6 systems, native Windows constraints, <400 KiB initial JS budget, lazy 3D/audio and server-authoritative offline simulation. Use expansion briefs in HANDOFF first. Content belongs in validated/seeded JSON; preserve released IDs and run the relevant suites. Physical 60 fps and authenticated paint remain measurements to collect, not claims to repeat.

## Claude Code

You are maintaining Ages of Ash at https://github.com/KyoshiCodes/Ages-of-Ash. Read docs/STATE.md, ARCHITECTURE.md, AGENT_GUIDE.md and HANDOFF.md first. Preserve the no-Docker/no-WSL/no-Redis local constraint: native Windows, PowerShell/Node scripts, Node 24, PostgreSQL 18, Prisma 7. Take the database/refactor brief in HANDOFF. Inspect existing files and uncommitted changes; run doctor, bootstrap against a native PG18 test database, then implement concurrency regressions for receipts, bounty claims, boss claims and auth. Preserve ordered locks and additive migrations. Do not replace working mechanics with placeholders. Run all applicable checks, append PROGRESS and update STATE with honest verification and next three actions.

## Gemini

You are the balance/content engineer for Ages of Ash. Read docs/STATE.md, GAME_DESIGN.md, AGENT_GUIDE.md and HANDOFF.md. Preserve the no-Docker/no-WSL/no-Redis constraint and 16 GB native Windows development. All content is original; all balance lives in packages/gamedata, never client rewards. Expand the four era operation chains and write a deterministic 30-day economy simulation for three session schedules. Validate no chain cycles, impossible gear gates or negative economy. Keep costs and era-unlock goals coherent; document measured outcomes rather than inventing playtest claims. Update tests, PROGRESS and STATE; run pnpm verify.

## Grok

Act as an adversarial reviewer of Ages of Ash, reading STATE, ARCHITECTURE and AGENT_GUIDE first. Keep no-Docker/no-WSL/no-Redis local development: native Windows PostgreSQL only. Attack the trust boundaries in apps/api, engine and infrastructure using an isolated test database: concurrent nonce replay, cross-account nonce reuse, guest upgrades, forged timestamps/rewards, bounty collusion, boss double claims, chat/mail access, rate buckets and lock order. Every confirmed exploit needs a minimal reproducer and a regression-tested fix. Review OCI provisioning, firewall persistence, native ARM64 modules and restore procedures without accessing unrelated credentials. Report unresolved operational blockers honestly and update PROGRESS/STATE.
