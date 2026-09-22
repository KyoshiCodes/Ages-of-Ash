# Ember Ledger rules and content workflow

The authoritative path is player row lock → server tick → arrival recap → validated intent → ledger/telemetry → state/receipt/audit → transactional notification. `packages/engine/src/chronicle.ts` owns the rules; no component can submit outcomes, rewards, timestamps or player state.

## Two tempos

Each operation reserves energy when started. Cautious guarantees success; bold succeeds 75% of the time for 1.8× cash. Failure retains 25% of the base cash, awards no XP/mastery and still leaves a memory. The server stores the success roll at start and masks it in snapshots. Resolution after three seconds grants XP, mastery, event/mastery/ash cash bonuses and ordinary loot exactly once through the nonce receipt. No automatic offline operations are invented.

For absence age `a` in hours, weighted time is `min(a,8) + .25 × max(0,min(a,24)-8)`. Resource clocks use differences of this cumulative function and carry fractional milliseconds. Holdings integrate across rate and pressure boundaries using rational integer remainders; they retain their 24-hour storage cap. Thus a laptop waking after 30 hours earns twelve effective hours, with caps applied. Background ticks never move the activity anchor. A visible authenticated snapshot or successful action marks arrival; a gap of at least two minutes creates a recap. Unread recaps merge, and acknowledging one cannot grant currency again.

The Glasswrit Office advances one pressure every hour even after the income cap, to six. Holding income is base tier income × offline weight × `(1+.10×linked owned neighbors)` × `(1-.04×pressure)` × `(1+.02×ash)`. Collection still removes 10% upkeep. Supply lines require owned reciprocal neighbors and cost 75 crowns. Suppression costs three stamina per pressure level.

## A book with consequences

Successful gameplay and social actions append an entry; polling and rejected attempts do not mint records. Auditing up to three intact/forged entries costs two nerve and yields one salvage per entry. A discovered forgery incurs a 120-crown fine. Forging costs three nerve, grants 90 crowns and adds 25 suspicion; 100 suspicion triggers a fine and faction escalation. Redaction costs 40 crowns and reduces suspicion ten. Only the playable text/status changes; the permanent audit is untouched.

Principled crew lose twenty loyalty on forgery; non-daring crew lose eight on bold operations. Cautious play restores two; reassurance costs 50 and restores fifteen. Below 25 they refuse new orders; below ten they defect. Rehire costs 200 and preserves history. Crew remember twelve recent operation outcomes and unlock their unique operation after the configured number of successes. Contacts are separate from the original era-affinity combat crew budget.

## Ash Cycle and session hooks

Sixty mastery across operations and four elapsed hours unlock the first cycle. Three starting-era chains make it reachable without a later-era equipment gate. A deterministic unit simulation reaches it within four to six hours using earned crowns for regen, never injected energy. This is a balance regression, not a human retention study.

Each cycle grants `floor(total mastery / 60)` ash. Level, XP, skill allocation and mastery reset; equipment becomes unequipped and era gates apply again. Holdings, cash, items, contacts, memories, receipts, badges and lore persist. Ash adds 2% operation cash/holding income per point; the original prestige combat bonus also persists. A four-hour minimum applies to each subsequent cycle.

Daily contracts, login streaks, the weekly ten-operation/two-crew contract and the Saturday UTC Ember Convergence give short/weekly/world hooks. Lore and badges unlock from operation, audit, holding and cycle metrics; badge marks are earned cosmetic currency. Daily/weekly UTC resets and claims remain server-owned.

## Add content

1. Edit `packages/gamedata/src/content.json` for eras/items/standard operations, `chronicle.json` for contacts, map nodes, lore, achievements and retention tuning, or `balance.json` for base numbers.
2. Keep stable IDs, reciprocal adjacency, valid item/crew references and acyclic operation prerequisites. Follow the tone bible in ART_DIRECTION before expanding prose.
3. Run `pnpm exec tsx scripts/validate-content.ts`, add rule/chain tests, then `pnpm verify:full`; review and explicitly run `pnpm db:deploy` and `pnpm db:seed` only for the intended persistent development database. The seed upserts content/config rows and upgrades legacy aggregates without resetting progress.
4. Run database and browser suites for a new system. Content removal requires an explicit compatibility migration for stored IDs; never rename released IDs casually.

Current catalog: twelve standard operations plus four crew operations, twelve items, four contacts, four supply nodes, five lore fragments and four material badges. The pipeline supports hundreds; the current catalog does not pretend to contain them.

## Retention measurement

`pnpm analytics` reports eligible/returned day-1 and day-7 cohorts, average session seconds, operations per session, median seconds to first Ash Cycle and final action step of sessions idle at least thirty minutes. A return means a new server session starting within `[createdAt+d days, createdAt+(d+1) days)`. Immature cohorts are excluded; zero eligible players is not 0% retention. Session length uses first/last observed visible activity, so it is an approximation and does not count time after the last observation. Operation counts include resolved failures.

No third-party analytics SDK, message text, password, cookie or fingerprint is recorded. Reports are operator CLI output, not public API. Guest and registered identities share progress; the seeded sparring operator is excluded from retention cohorts. Local smoke accounts are test data and must not be presented as product retention evidence.

// TODO(agent): Publish the production privacy notice, assign a retention-cleanup operator, and verify 30-day deletion on a non-production copy without touching reward receipts.
