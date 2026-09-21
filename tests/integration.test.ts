/** Real PostgreSQL concurrency regression. Uses isolated players; cleans only its own records. */
import "dotenv/config";
import { it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, closeDatabase } from "../packages/database/src/index.ts";
import { initialState, stateSchema } from "../packages/engine/src/index.ts";
import {
  perform,
  performFeature,
  snapshot,
  worldAction,
} from "../apps/api/src/service.ts";
import { eventAt } from "../packages/gamedata/src/index.ts";
const ids: string[] = [];
it("persists offline reports, ledger consequences, supply, prestige and telemetry atomically", async () => {
  const id = randomUUID();
  ids.push(id);
  const now = Date.now(),
    s = initialState(now - 30 * 3600000);
  s.cash = 2000;
  s.resources.energy = 0;
  s.mastery = { quay: 20, ledger: 20, tally: 20 };
  s.holdings = [
    { era: 0, tier: 1, bank: 0, lastAt: s.lastTickAt },
    { era: 1, tier: 1, bank: 0, lastAt: s.lastTickAt },
  ];
  s.crew.push(0);
  await prisma.player.create({
    data: { id, name: "Chronicle integration", state: s },
  });
  const hidden = await snapshot(id, false);
  expect(hidden.state.chronicle.lastActiveAt).toBe(s.chronicle.lastActiveAt);
  expect(await prisma.playSession.count({ where: { playerId: id } })).toBe(0);
  const welcome = await snapshot(id);
  expect(welcome.state.chronicle.report?.gains.income).toBeGreaterThan(0);
  await performFeature(id, {
    nonce: randomUUID(),
    type: "network-link",
    key: "quay:steps",
  });
  await performFeature(id, { nonce: randomUUID(), type: "threat-suppress" });
  await performFeature(id, { nonce: randomUUID(), type: "ledger-forge" });
  await performFeature(id, { nonce: randomUUID(), type: "ledger-audit" });
  const cycle = { nonce: randomUUID(), type: "ash-cycle" as const };
  await Promise.all([performFeature(id, cycle), performFeature(id, cycle)]);
  const result = await snapshot(id);
  expect(result.state.chronicle.ash).toBe(1);
  expect(result.state.chronicle.links).toContain("quay:steps");
  expect(result.state.chronicle.totals.audits).toBe(1);
  expect(
    await prisma.telemetryEvent.count({
      where: { playerId: id, type: "ash-cycle" },
    }),
  ).toBe(1);
  expect(await prisma.playSession.count({ where: { playerId: id } })).toBe(1);
  expect(await prisma.contentDefinition.count()).toBeGreaterThan(50);
  expect(
    (
      await prisma.contentDefinition.findUniqueOrThrow({
        where: { key: "config:offline" },
      })
    ).definition,
  ).toMatchObject({ fullHours: 8, maximumHours: 24 });
});
afterAll(async () => {
  await prisma.bounty.deleteMany({ where: { issuerId: { in: ids } } });
  await prisma.contribution.deleteMany({ where: { playerId: { in: ids } } });
  await prisma.player.deleteMany({ where: { id: { in: ids } } });
  await closeDatabase();
});
it("locks bounty payout and contribution reward claims against replay", async () => {
  const issuer = randomUUID(),
    hunter = randomUUID(),
    target = randomUUID();
  ids.push(issuer, hunter, target);
  for (const id of [issuer, hunter, target]) {
    const s = initialState(Date.now());
    if (id === hunter) s.stats.attack = 100;
    await prisma.player.create({
      data: { id, name: "Escrow regression", state: s },
    });
  }
  await perform(issuer, { nonce: randomUUID(), type: "bounty", target });
  const attack = { nonce: randomUUID(), type: "attack" as const, target };
  await Promise.all([perform(hunter, attack), perform(hunter, attack)]);
  expect(
    await prisma.bounty.count({
      where: { issuerId: issuer, claimedBy: hunter },
    }),
  ).toBe(1);
  const hunterRow = await prisma.player.findUniqueOrThrow({
    where: { id: hunter },
  });
  expect(stateSchema.parse(hunterRow.state).bountiesWon).toBe(1);
  const world = await prisma.world.findUniqueOrThrow({
    where: { id: "leviathan" },
  });
  const cycle = world.cycle - 1;
  await prisma.contribution.create({
    data: { playerId: hunter, cycle, damage: 1000 },
  });
  const nonce = randomUUID();
  await Promise.all([
    worldAction(hunter, nonce, true),
    worldAction(hunter, nonce, true),
  ]);
  const after = stateSchema.parse(
    (await prisma.player.findUniqueOrThrow({ where: { id: hunter } })).state,
  );
  expect(after.cash - stateSchema.parse(hunterRow.state).cash).toBe(500);
  expect(
    (
      await prisma.contribution.findUniqueOrThrow({
        where: { playerId_cycle: { playerId: hunter, cycle } },
      })
    ).claimed,
  ).toBe(true);
  await expect(worldAction(hunter, randomUUID(), true)).rejects.toThrow(
    "No defeated boss",
  );
});
it("same nonce concurrently rewards exactly once; overspending rolls back", async () => {
  const id = randomUUID();
  ids.push(id);
  await prisma.player.create({
    data: { id, name: "Integration operator", state: initialState(Date.now()) },
  });
  const command = { nonce: randomUUID(), type: "job" as const, key: "quay" };
  const results = await Promise.all([
    perform(id, command),
    perform(id, command),
  ]);
  expect(results[0]).toEqual(results[1]);
  await expect(
    performFeature(id, { nonce: randomUUID(), type: "operation-resolve" }),
  ).rejects.toThrow("underway");
  await new Promise((resolve) => setTimeout(resolve, 3100));
  const settlement = {
    nonce: randomUUID(),
    type: "operation-resolve" as const,
  };
  await Promise.all([
    performFeature(id, settlement),
    performFeature(id, settlement),
  ]);
  let row = await prisma.player.findUniqueOrThrow({ where: { id } });
  const earned = 400 + Math.floor(45 * eventAt(Date.now()).multiplier);
  expect(stateSchema.parse(row.state).cash).toBe(earned);
  expect(await prisma.audit.count({ where: { playerId: id } })).toBe(2);
  await Promise.allSettled(
    Array.from({ length: 15 }, () =>
      perform(id, { nonce: randomUUID(), type: "buy", key: "bike" }),
    ),
  );
  row = await prisma.player.findUniqueOrThrow({ where: { id } });
  expect(stateSchema.parse(row.state).cash).toBe(earned % 100);
  expect(stateSchema.parse(row.state).inventory.bike.quantity).toBe(4);
}, 20000);
