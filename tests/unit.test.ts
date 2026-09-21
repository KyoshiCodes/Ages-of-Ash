/** Balance and trust-boundary tests; duplicate time and invalid rewards must never mint value. */
import { describe, it, expect } from "vitest";
import {
  initialState,
  tick,
  caps,
  combat,
  loot,
  reward,
  applyAction,
  power,
  actionSchema,
} from "../packages/engine/src/index.ts";
import { randomUUID } from "node:crypto";
import {
  applyFeature,
  arrive,
  ledgerEntry,
  weightedAge,
  featureSchema,
} from "../packages/engine/src/chronicle.ts";
import { validateContent } from "../packages/gamedata/src/schema.ts";
import { chronicleData } from "../packages/gamedata/src/index.ts";
const action = (
  type: Parameters<typeof applyAction>[1]["type"],
  key?: string,
) => ({ nonce: randomUUID(), type, key });
describe("clock math", () => {
  it("catches up after sleep, preserves remainder, caps and is idempotent", () => {
    const s = initialState(1000);
    s.resources.energy = 0;
    tick(s, 121500);
    expect(s.resources.energy).toBe(2);
    expect(s.lastTickAt).toBe(121500);
    tick(s, 121500);
    expect(s.resources.energy).toBe(2);
    tick(s, 864001000);
    expect(s.resources).toEqual(caps(s));
  });
  it("cannot rewind or overcollect holdings", () => {
    const s = initialState(1000);
    s.holdings = [{ era: 0, tier: 1, lastAt: 1000, bank: 0 }];
    tick(s, 100);
    expect(s.lastTickAt).toBe(1000);
    tick(s, 1000 + 100 * 3600000);
    expect(s.holdings[0].bank).toBe(298);
    tick(s, 1000 + 100 * 3600000);
    expect(s.holdings[0].bank).toBe(298);
  });
});
describe("Ember Ledger retention systems", () => {
  it("rejects forged feature clocks, rewards and random outcomes", () => {
    for (const extra of [
      { now: 1 },
      { cash: 1000 },
      { roll: 0 },
      { readyAt: 0 },
    ])
      expect(
        featureSchema.safeParse({
          nonce: randomUUID(),
          type: "operation-start",
          key: "quay",
          ...extra,
        }).success,
      ).toBe(false);
  });
  it("reaches a first Ash Cycle within six hours using earned energy and crowns", () => {
    const s = initialState(0);
    let closedAt = 0;
    for (let now = 60000; now <= 6 * 3600000; now += 60000) {
      tick(s, now);
      arrive(s, now);
      if (s.regen === 0 && s.cash >= 200)
        applyAction(s, action("regen"), now, () => 0.5);
      const key = ["quay", "ledger", "tally"].find(
        (id) => (s.mastery[id] ?? 0) < 20,
      );
      if (key) {
        const cost = key === "quay" ? 4 : key === "ledger" ? 7 : 8;
        if (s.resources.energy >= cost) {
          applyFeature(
            s,
            { nonce: randomUUID(), type: "operation-start", key },
            now,
            () => 0,
          );
          applyFeature(
            s,
            { nonce: randomUUID(), type: "operation-resolve" },
            now + 3000,
            () => 0.5,
          );
        }
      }
      if (
        Object.values(s.mastery).reduce((a, b) => a + b, 0) >= 60 &&
        now >= 4 * 3600000
      ) {
        applyFeature(
          s,
          { nonce: randomUUID(), type: "ash-cycle" },
          now,
          () => 0,
        );
        closedAt = now;
        break;
      }
    }
    expect(closedAt).toBeGreaterThanOrEqual(4 * 3600000);
    expect(closedAt).toBeLessThanOrEqual(6 * 3600000);
    expect(s.chronicle.ash).toBe(1);
  });
  const hour = 3600000;
  const feature = (
    s: ReturnType<typeof initialState>,
    type: Parameters<typeof applyFeature>[1]["type"],
    now = 0,
    key?: string,
  ) => applyFeature(s, { nonce: randomUUID(), type, key }, now, () => 0);
  it("validates authored content and rejects broken references", () => {
    const data = validateContent();
    expect(data.chronicle.crew).toHaveLength(4);
    expect(() =>
      validateContent({
        ...data.content,
        jobs: [{ ...data.content.jobs[0], previous: "missing" }],
      }),
    ).toThrow("prior");
  });
  it("caps offline credit and exactly matches irregular worker catch-up", () => {
    expect(weightedAge(8 * hour)).toBe(8 * hour);
    expect(weightedAge(24 * hour)).toBe(12 * hour);
    expect(weightedAge(100 * hour)).toBe(12 * hour);
    const lazy = initialState(0);
    lazy.resources.energy = 0;
    lazy.holdings = [{ era: 0, tier: 1, bank: 0, lastAt: 0 }];
    const frequent = structuredClone(lazy);
    for (let t = 17317; t < 30 * hour; t += 17317) tick(frequent, t);
    tick(frequent, 30 * hour);
    tick(lazy, 30 * hour);
    expect(frequent.resources).toEqual(lazy.resources);
    expect(frequent.holdings).toEqual(lazy.holdings);
    expect(frequent.chronicle.holdingRemainders).toEqual(
      lazy.chronicle.holdingRemainders,
    );
    arrive(lazy, 30 * hour);
    expect(lazy.chronicle.report?.gains.income).toBeGreaterThan(0);
    expect(lazy.chronicle.report?.gains.escalations).toBe(6);
    const report = structuredClone(lazy.chronicle.report);
    tick(lazy, 30 * hour);
    arrive(lazy, 30 * hour);
    expect(lazy.chronicle.report).toEqual(report);
    feature(lazy, "report-ack", 30 * hour, report!.id);
    expect(lazy.chronicle.report).toBeNull();
  });
  it("reserves energy, rejects early settlement, settles once and preserves loot", () => {
    const s = initialState(0);
    feature(s, "operation-start", 0, "quay");
    expect(s.cash).toBe(400);
    expect(s.resources.energy).toBeLessThan(30);
    expect(() => feature(s, "operation-resolve", 2999)).toThrow("underway");
    feature(s, "operation-resolve", 3000);
    expect(s.cash).toBeGreaterThan(400);
    expect(s.shards).toBe(1);
    expect(s.chronicle.companions[0].successes).toBe(1);
    expect(s.chronicle.badges).toContain("ink");
    expect(() => feature(s, "operation-resolve", 3000)).toThrow("No operation");
  });
  it("records risky failures, refusal, defection and a recoverable rehire", () => {
    const s = initialState(0);
    applyFeature(
      s,
      {
        nonce: randomUUID(),
        type: "operation-start",
        key: "quay",
        approach: "bold",
        crewId: "mara",
      },
      0,
      () => 0.99,
    );
    feature(s, "operation-resolve", 3000);
    expect(s.chronicle.resolution?.success).toBe(false);
    expect(s.chronicle.companions[0].memories).toHaveLength(1);
    s.chronicle.companions[0].loyalty = 20;
    expect(() => feature(s, "operation-start", 4000, "quay")).toThrow(
      "refuses",
    );
    feature(s, "ledger-forge");
    expect(s.chronicle.companions[0].defected).toBe(true);
    feature(s, "crew-recruit", 0, "mara");
    expect(s.chronicle.companions[0].defected).toBe(false);
    expect(s.chronicle.companions[0].memories).toHaveLength(1);
  });
  it("audits and redacts playable records with fines and resource costs", () => {
    const s = initialState(0);
    feature(s, "ledger-forge");
    ledgerEntry(s, "ledger-forge", "Unlawful entry", 0, "forged");
    const cash = s.cash;
    feature(s, "ledger-audit");
    expect(s.cash).toBe(cash - 120);
    expect(s.chronicle.entries[0].status).toBe("audited");
    feature(s, "ledger-redact", 0, s.chronicle.entries[0].id);
    expect(s.chronicle.entries[0].text).toBe("[REDACTED]");
    expect(s.salvage).toBe(1);
  });
  it("requires owned adjacent supply nodes and suppresses escalating factions", () => {
    const s = initialState(0);
    s.holdings = [
      { era: 0, tier: 1, bank: 0, lastAt: 0 },
      { era: 1, tier: 1, bank: 0, lastAt: 0 },
    ];
    feature(s, "network-link", 0, "quay:steps");
    expect(() => feature(s, "network-link", 0, "quay:drift")).toThrow(
      "adjacent",
    );
    tick(s, hour);
    expect(s.holdings[0].bank).toBe(33);
    expect(s.chronicle.pressure).toBe(1);
    feature(s, "threat-suppress", hour);
    expect(s.chronicle.pressure).toBe(0);
  });
  it("gates prestige, preserves assets and unlocks permanent lore and badges", () => {
    const s = initialState(0);
    s.mastery = { quay: 20, ledger: 20, beacon: 20 };
    expect(() => feature(s, "ash-cycle", hour)).toThrow("four hours");
    feature(s, "ash-cycle", 4 * hour);
    expect(s.chronicle.ash).toBe(1);
    expect(s.level).toBe(1);
    expect(s.mastery).toEqual({});
    expect(s.chronicle.lore.length).toBeGreaterThan(0);
    expect(s.chronicle.badges).toContain(
      chronicleData.achievements.find((b) => b.metric === "cycles")!.id,
    );
  });
  it("claims weekly crew reward once and unlocks history operations", () => {
    const s = initialState(0);
    s.chronicle.weeklyOps = 10;
    s.crew.push(0);
    feature(s, "weekly-crew");
    expect(() => feature(s, "weekly-crew")).toThrow("not ready");
    s.chronicle.companions[0].successes = 3;
    feature(s, "operation-start", 0, chronicleData.crew[0].operation);
    feature(s, "operation-resolve", 3000);
    expect(s.chronicle.resolution?.success).toBe(true);
  });
});
describe("combat and gear", () => {
  it("keeps variance bounded and rejects invalid RNG", () => {
    expect(combat(200, 100, 0).won).toBe(true);
    expect(combat(50, 100, 0.999).won).toBe(false);
    expect(() => combat(100, 100, 1)).toThrow();
    expect(combat(10000, 1, 0.5).damage).toBe(35);
  });
  it("crew limits equipment contributions", () => {
    const s = initialState(0);
    s.inventory.knife.quantity = 100;
    const before = power(s);
    s.inventory.knife.quantity = 1;
    expect(power(s)).toBe(before);
    s.crew.push(0);
    s.inventory.knife.quantity = 2;
    expect(power(s)).toBeGreaterThan(before);
  });
  it("blocks repeat farming and protected targets", () => {
    const s = initialState(0),
      t = initialState(0);
    const a = { ...action("attack"), target: randomUUID() };
    applyAction(s, a, 1_000_000, () => 0.5, t);
    expect(() => applyAction(s, a, 1_100_000, () => 0.5, t)).toThrow(
      "protected",
    );
  });
});
describe("rewards and progression", () => {
  it("does not bypass era gates by equipping retained gear after ascension", () => {
    const s = initialState(0);
    s.level = 30;
    s.inventory.blade = { quantity: 1, upgrade: 0, equipped: true };
    applyAction(s, action("prestige"), 0, () => 0.5);
    expect(s.inventory.blade.equipped).toBe(false);
    expect(() =>
      applyAction(s, action("equip", "blade"), 0, () => 0.5),
    ).toThrow("locked");
  });
  it("defines deterministic rarity boundaries", () => {
    expect(loot(0)).toBe("shard");
    expect(loot(0.01)).toBe("salvage");
    expect(loot(0.2)).toBe("none");
    expect(() => loot(-1)).toThrow();
  });
  it("rejects negative, fractional and excessive rewards", () => {
    for (const x of [-1, 0.5, Infinity, 1_000_001])
      expect(() => reward(initialState(0), x, 0)).toThrow();
  });
  it("rejects injected reward fields and client timestamps", () => {
    expect(
      actionSchema.safeParse({ ...action("job", "quay"), cash: 99999 }).success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({ ...action("job", "quay"), now: 1 }).success,
    ).toBe(false);
  });
  it("runs operations, levels, spends skills and mastery unlocks", () => {
    const s = initialState(1000);
    for (let i = 0; i < 5; i++)
      applyAction(s, action("job", "quay"), 1000, () => 0.9);
    expect(s.level).toBe(2);
    expect(s.skills).toBe(3);
    applyAction(s, action("skill", "attack"), 1000, () => 0.9);
    expect(s.stats.attack).toBe(1);
    expect(s.skills).toBe(2);
    applyAction(s, action("job", "ledger"), 1000, () => 0.9);
    expect(s.mastery.ledger).toBe(1);
  });
  it("never lets locked-era actions spend resources", () => {
    const s = initialState(0);
    expect(() => applyAction(s, action("job", "beacon"), 0, () => 0.5)).toThrow(
      "locked",
    );
    expect(s.resources.energy).toBe(30);
  });
});
