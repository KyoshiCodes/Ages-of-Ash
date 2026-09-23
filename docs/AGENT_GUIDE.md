# Agent guide

Read STATE, DECISIONS, ARCHITECTURE and PROGRESS before edits. Run `pnpm run doctor` and inspect git status. Preserve uncommitted work. Canonical remote is https://github.com/KyoshiCodes/Ages-of-Ash; never publish this project elsewhere implicitly.

House rules: application entries belong in apps; reusable rules in packages/engine; every tunable content number belongs in packages/gamedata. Prisma is the database schema authority alongside checked-in constraints. CamelCase TS values, PascalCase types/components/models, kebab-case scripts/docs links. Every nontrivial source file has a responsibility/invariant header. Mark actionable gaps with `// TODO(agent): concrete task` and update STATE immediately.

Prisma stays at 7.10.0. Read RETENTION, PERFORMANCE and ART_DIRECTION before expansion work. New content/config goes into content.json, chronicle.json or balance.json with Zod validation and catalog seed. Keep lastActiveAt separate from lastTickAt and preserve fractional/rational credit. New systems require unit, database and browser coverage. Build enforces the static import budget. Never present synthetic analytics cohorts as real retention.

Add a job by adding an original content row in content.json with an existing era, positive energy/reward values, known required item and previous job. Add a chain-unlock test and play the job in the browser. Add an item with one of three existing slots, era, rarity, attack/defense and guaranteed price; test crew-budget interaction. Add a boss by defining its tuning in gamedata, deterministic phases in engine, transactional persistence in API and a phase/replay test. Never put rewards only in a component.

Migration workflow: edit schema, provision a separate shadow database for development, configure shadowDatabaseUrl in prisma.config.ts as appropriate, run `pnpm db:migrate --name descriptive_change`, inspect generated SQL and preserve hand-authored FK/check constraints, run `pnpm db:generate`. Update the latest-migration marker in `apps/api/src/readiness.ts` for every new release migration. New persistent aggregate fields require a JSON data migration. Test migration from a copy of old data and from empty. Use migrate deploy in deployment and first-time setup; never reset a live database.

Before commit: `pnpm verify:fast`; for database, release, UI/auth or core-loop changes run `pnpm verify:full` against a disposable database. Doctor is read-only; apply migrations and seed only through explicit commands after review. If infrastructure is unavailable, report unverified checks explicitly rather than claiming a pass. Commit messages follow Conventional Commits. Append a system-level PROGRESS entry and maintain exactly three immediate next actions in STATE. Do not overwrite old progress entries.

Never do this:

1. Never introduce Docker, WSL, or Redis into local development.
2. Never trust a client clock, supplied reward, player aggregate or random roll.
3. Never bypass nonce checks, ordered locks or audit on value-bearing actions.
4. Never store plaintext passwords or tokens in the database, or commit .env.
5. Never delete data, rewrite remote branches, or rotate existing credentials implicitly.
6. Keep gameplay in DOM/CSS/SVG; the explicitly requested optional 3D inspections must stay lazy, disposable, low-power and disabled by reduced-motion. Never put them in the initial bundle.
7. Never create paid random rewards, third-party IP content, or premium combat advantages.
8. Never label an unexecuted test, migration, deployment or restore as verified.

Local scripts are PowerShell or Node/TypeScript. Native Windows PostgreSQL is the only local service. The shared interfaces leave room for future production adapters, but that is not permission to add local dependencies.

OCI staging rule: read OCI_STAGING_ARCHITECTURE, OCI_STAGING_RUNBOOK, STAGING_INTAKE_TEMPLATE and RECOVERY_OWNERSHIP_TEMPLATE before changing deploy assets. Completed intake, OCI profiles, cloud IDs, key material, bucket names, DNS records, dump files and named people stay outside Git. `pnpm staging:preflight`/`staging:plan` are read-only; never add cloud mutation to them. Do not provision, deploy, migrate, restore, alter firewall/DNS, create cloud identities/secrets or assign operational authority without the operator gate. Preserve distinct Unix/env identities, fixed argument-array CLI calls with shell:false, exact-commit release, migration approval and populated-target refusal. Run `pnpm verify:full` after deployment-script changes. Never label offline plan, CI parity or emulated performance as OCI/physical-device evidence.

OCI staging agents: preserve the explicit private-no-dns/public-dns mode split. Never infer mode from missing DNS; never run the public-only host provisioner for private mode or claim static preflight proves cost, public TLS, or off-host backup.
