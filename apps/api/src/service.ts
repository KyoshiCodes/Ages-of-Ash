/** Transaction boundary for all game mutations. Ordered player locks precede world locks. */
import type { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma } from "../../../packages/database/src/index.ts";
import {
  applyAction,
  stateSchema,
  tick,
  power,
  reward,
  requireRule,
  spend,
} from "../../../packages/engine/src/index.ts";
import type { Action } from "../../../packages/engine/src/index.ts";
import { balance } from "../../../packages/gamedata/src/index.ts";
import {
  applyFeature,
  arrive,
  ledgerEntry,
  featureSchema,
} from "../../../packages/engine/src/chronicle.ts";
import type { FeatureAction } from "../../../packages/engine/src/chronicle.ts";
import { recordActivity } from "./telemetry.ts";
import { deskProjection } from "../../../packages/engine/src/presentation.ts";
export const rng = () => randomInt(0, 1_000_000) / 1_000_000;
type Tx = Prisma.TransactionClient;
export async function lockPlayers(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort())
    await tx.$queryRaw`SELECT id FROM "Player" WHERE id=${id}::uuid FOR UPDATE`;
}
export async function notify(tx: Tx, playerId?: string) {
  await tx.$queryRaw`SELECT pg_notify('ages_live',${JSON.stringify(playerId ? { type: "state", playerId } : { type: "world" })})::text`;
}
export async function perform(playerId: string, action: Action) {
  if (action.type === "job")
    return performFeature(
      playerId,
      featureSchema.parse({
        nonce: action.nonce,
        type: "operation-start",
        key: action.key,
      }),
    );
  if (action.type === "prestige")
    return performFeature(playerId, { nonce: action.nonce, type: "ash-cycle" });
  requireRule(action.target !== playerId, "Cannot target yourself");
  return prisma.$transaction(
    async (tx) => {
      await lockPlayers(tx, [
        playerId,
        ...(action.target ? [action.target] : []),
      ]);
      const old = await tx.receipt.findUnique({
        where: { nonce: action.nonce },
      });
      if (old) {
        requireRule(
          old.playerId === playerId,
          "Nonce belongs to another player",
        );
        return old.result;
      }
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
      });
      const target = action.target
        ? await tx.player.findUniqueOrThrow({ where: { id: action.target } })
        : undefined;
      const now = Date.now();
      const state = tick(stateSchema.parse(player.state), now);
      arrive(state, now);
      const enemy = target
        ? tick(stateSchema.parse(target.state), now)
        : undefined;
      let message: string;
      if (action.type === "bounty") {
        requireRule(target && enemy, "Target required");
        requireRule(
          Math.abs(state.level - enemy.level) <= balance.pvp.bracketMinimum,
          "Bounty target outside bracket",
        );
        spend(state, "cash", balance.pvp.bounty);
        await tx.bounty.create({
          data: {
            issuerId: playerId,
            targetId: target.id,
            amount: balance.pvp.bounty,
          },
        });
        message = `${balance.pvp.bounty} crowns placed in bounty escrow`;
      } else {
        message = applyAction(state, action, now, rng, enemy);
        if (target && enemy && ["attack", "raid"].includes(action.type)) {
          enemy.retaliation[playerId] = now + balance.retaliationMs;
          if (message.startsWith("Duel won")) {
            const bounties = await tx.bounty.findMany({
              where: {
                targetId: target.id,
                claimedBy: null,
                issuerId: { not: playerId },
              },
              take: 100,
            });
            for (const bounty of bounties) {
              await tx.bounty.update({
                where: { id: bounty.id },
                data: { claimedBy: playerId },
              });
              reward(state, bounty.amount, 0);
              state.bountiesWon++;
            }
            if (
              player.guildId &&
              target.guildId &&
              player.guildId !== target.guildId
            ) {
              const war = await tx.war.findFirst({
                where: {
                  expiresAt: { gt: new Date(now) },
                  OR: [
                    { attackerId: player.guildId, defenderId: target.guildId },
                    { attackerId: target.guildId, defenderId: player.guildId },
                  ],
                },
              });
              if (war) state.influence[0] += balance.pvp.warInfluence;
            }
          }
          await tx.player.update({
            where: { id: target.id },
            data: { state: enemy },
          });
          await notify(tx, target.id);
        }
      }
      ledgerEntry(state, action.type, message, now);
      await recordActivity(tx, playerId, state, now, action.type);
      stateSchema.parse(state);
      await tx.player.update({ where: { id: playerId }, data: { state } });
      const result = { message };
      await tx.receipt.create({
        data: { nonce: action.nonce, playerId, result },
      });
      await tx.audit.create({
        data: { playerId, action: action.type, detail: { ...action, message } },
      });
      await notify(tx, playerId);
      return result;
    },
    { timeout: 10000 },
  );
}
export async function worldAction(
  playerId: string,
  nonce: string,
  claim: boolean,
) {
  return prisma.$transaction(async (tx) => {
    await lockPlayers(tx, [playerId]);
    const old = await tx.receipt.findUnique({ where: { nonce } });
    if (old) {
      requireRule(old.playerId === playerId, "Invalid nonce");
      return old.result;
    }
    await tx.$queryRaw`SELECT id FROM "World" WHERE id='leviathan' FOR UPDATE`;
    const world = await tx.world.findUniqueOrThrow({
      where: { id: "leviathan" },
    });
    const player = await tx.player.findUniqueOrThrow({
      where: { id: playerId },
    });
    const s = tick(stateSchema.parse(player.state), Date.now());
    arrive(s, Date.now());
    let message = "";
    if (claim) {
      const entry = await tx.contribution.findFirst({
        where: {
          playerId,
          claimed: false,
          OR: [
            { cycle: { lt: world.cycle } },
            ...(world.hp === 0 ? [{ cycle: world.cycle }] : []),
          ],
        },
        orderBy: { cycle: "asc" },
      });
      requireRule(entry, "No defeated boss contribution to claim");
      reward(
        s,
        Math.floor(
          (balance.world.cash * entry.damage) / balance.worldBossHealth,
        ),
        Math.floor((balance.world.xp * entry.damage) / balance.worldBossHealth),
      );
      s.shards += Math.max(
        balance.world.minimumShards,
        Math.floor(
          (balance.world.shards * entry.damage) / balance.worldBossHealth,
        ),
      );
      await tx.contribution.update({
        where: { playerId_cycle: { playerId, cycle: entry.cycle } },
        data: { claimed: true },
      });
      message = "Contribution reward claimed";
    } else {
      requireRule(world.hp > 0, "World boss defeated; claim your share");
      requireRule(
        s.resources.stamina >= balance.world.stamina &&
          s.resources.health > balance.world.minimumHealth,
        "Recover before joining raid",
      );
      s.resources.stamina -= balance.world.stamina;
      s.resources.health -= balance.world.health;
      const damage = Math.min(
        world.hp,
        Math.floor(power(s) * balance.world.damageMultiplier),
      );
      await tx.world.update({
        where: { id: world.id },
        data: { hp: { decrement: damage } },
      });
      await tx.contribution.upsert({
        where: { playerId_cycle: { playerId, cycle: world.cycle } },
        create: { playerId, cycle: world.cycle, damage },
        update: { damage: { increment: damage } },
      });
      message = `Sablecoil Leviathan takes ${damage} damage`;
    }
    ledgerEntry(s, claim ? "world-claim" : "world-strike", message, Date.now());
    await recordActivity(
      tx,
      playerId,
      s,
      Date.now(),
      claim ? "world-claim" : "world-strike",
    );
    stateSchema.parse(s);
    await tx.player.update({ where: { id: playerId }, data: { state: s } });
    const result = { message };
    await tx.receipt.create({ data: { nonce, playerId, result } });
    await tx.audit.create({
      data: {
        playerId,
        action: claim ? "world-claim" : "world-strike",
        detail: result,
      },
    });
    await notify(tx);
    return result;
  });
}
export async function snapshot(playerId: string, active = true) {
  return prisma.$transaction(async (tx) => {
    await lockPlayers(tx, [playerId]);
    const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    const state = tick(stateSchema.parse(p.state), Date.now());
    if (active) {
      arrive(state, Date.now());
      await recordActivity(tx, playerId, state, Date.now());
    }
    await tx.player.update({ where: { id: playerId }, data: { state } });
    // Preserve the shared snapshot shape while concealing the committed server-only outcome.
    const visibleState = structuredClone(state);
    if (visibleState.chronicle.operation)
      visibleState.chronicle.operation.roll = 0;
    return {
      id: p.id,
      name: p.name,
      guest: !p.email,
      guildId: p.guildId,
      state: visibleState,
      desk: deskProjection(state, Date.now()),
      serverTime: Date.now(),
    };
  });
}

export async function performFeature(playerId: string, action: FeatureAction) {
  return prisma.$transaction(
    async (tx) => {
      await lockPlayers(tx, [playerId]);
      const old = await tx.receipt.findUnique({
        where: { nonce: action.nonce },
      });
      if (old) {
        requireRule(
          old.playerId === playerId,
          "Nonce belongs to another player",
        );
        return old.result;
      }
      const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      const now = Date.now(),
        s = tick(stateSchema.parse(p.state), now);
      arrive(s, now);
      const message = applyFeature(s, action, now, rng);
      ledgerEntry(
        s,
        action.type,
        message,
        now,
        action.type === "ledger-forge" ? "forged" : "intact",
      );
      await recordActivity(tx, playerId, s, now, action.type);
      stateSchema.parse(s);
      await tx.player.update({ where: { id: playerId }, data: { state: s } });
      const result = { message };
      await tx.receipt.create({
        data: { nonce: action.nonce, playerId, result },
      });
      await tx.audit.create({
        data: { playerId, action: action.type, detail: { ...action, message } },
      });
      await notify(tx, playerId);
      return result;
    },
    { timeout: 10000 },
  );
}
