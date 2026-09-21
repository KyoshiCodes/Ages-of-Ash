/** Validated balance data; formulas remain pure and all tunable constants are authored in JSON. */
import { z } from "zod";
import raw from "./balance.json" with { type: "json" };
export const balanceSchema = z
  .object({
    initialCash: z.number().finite().nonnegative(),
    initialResources: z
      .object({
        energy: z.number().finite().nonnegative(),
        stamina: z.number().finite().nonnegative(),
        health: z.number().finite().nonnegative(),
        nerve: z.number().finite().nonnegative(),
      })
      .strict(),
    capPerLevel: z
      .object({
        energy: z.number().finite().nonnegative(),
        stamina: z.number().finite().nonnegative(),
        health: z.number().finite().nonnegative(),
        nerveEvery: z.number().finite().nonnegative(),
      })
      .strict(),
    capPerSkill: z
      .object({
        energy: z.number().finite().nonnegative(),
        stamina: z.number().finite().nonnegative(),
        health: z.number().finite().nonnegative(),
      })
      .strict(),
    regenBase: z.number().finite().nonnegative(),
    healthRegenBase: z.number().finite().nonnegative(),
    maxRegen: z.number().finite().nonnegative(),
    skillPointsPerLevel: z.number().finite().nonnegative(),
    lootShardThreshold: z.number().finite().nonnegative(),
    lootSalvageThreshold: z.number().finite().nonnegative(),
    lootSalvage: z.number().finite().nonnegative(),
    gearUpgradeMultiplier: z.number().finite().nonnegative(),
    affinityMultiplier: z.number().finite().nonnegative(),
    maxStack: z.number().finite().nonnegative(),
    maxUpgrade: z.number().finite().nonnegative(),
    basePower: z.number().finite().nonnegative(),
    powerPerLevel: z.number().finite().nonnegative(),
    powerPerSkill: z.number().finite().nonnegative(),
    prestigeMultiplier: z.number().finite().nonnegative(),
    prestigeLevel: z.number().finite().nonnegative(),
    varianceMin: z.number().finite().nonnegative(),
    varianceRange: z.number().finite().nonnegative(),
    minDamage: z.number().finite().nonnegative(),
    maxDamage: z.number().finite().nonnegative(),
    baseDamage: z.number().finite().nonnegative(),
    masteryTierBonus: z.number().finite().nonnegative(),
    masteryCap: z.number().finite().nonnegative(),
    maxHoldingTier: z.number().finite().nonnegative(),
    holdingUpkeep: z.number().finite().nonnegative(),
    craftSalvageBase: z.number().finite().nonnegative(),
    upgradeSalvageBase: z.number().finite().nonnegative(),
    upgradeShardEvery: z.number().finite().nonnegative(),
    salvagePerCopy: z.number().finite().nonnegative(),
    tonicCost: z.number().finite().nonnegative(),
    tonicHealing: z.number().finite().nonnegative(),
    solo: z
      .object({
        minimumHealth: z.number().finite().nonnegative(),
        stamina: z.number().finite().nonnegative(),
        phaseThresholds: z.array(z.number().finite().nonnegative()),
        correctMultiplier: z.number().finite().nonnegative(),
        wrongMultiplier: z.number().finite().nonnegative(),
        correctDamage: z.number().finite().nonnegative(),
        wrongDamage: z.number().finite().nonnegative(),
        cash: z.number().finite().nonnegative(),
        xp: z.number().finite().nonnegative(),
        shards: z.number().finite().nonnegative(),
        salvage: z.number().finite().nonnegative(),
        cooldownMs: z.number().finite().nonnegative(),
      })
      .strict(),
    pvp: z
      .object({
        bracketMinimum: z.number().finite().nonnegative(),
        bracketFraction: z.number().finite().nonnegative(),
        minimumHealth: z.number().finite().nonnegative(),
        stamina: z.number().finite().nonnegative(),
        retaliationMultiplier: z.number().finite().nonnegative(),
        winDamage: z.number().finite().nonnegative(),
        lossDamage: z.number().finite().nonnegative(),
        maxStolen: z.number().finite().nonnegative(),
        stolenFraction: z.number().finite().nonnegative(),
        xp: z.number().finite().nonnegative(),
        raidFraction: z.number().finite().nonnegative(),
        bounty: z.number().finite().nonnegative(),
        warInfluence: z.number().finite().nonnegative(),
      })
      .strict(),
    world: z
      .object({
        stamina: z.number().finite().nonnegative(),
        health: z.number().finite().nonnegative(),
        minimumHealth: z.number().finite().nonnegative(),
        damageMultiplier: z.number().finite().nonnegative(),
        cash: z.number().finite().nonnegative(),
        xp: z.number().finite().nonnegative(),
        shards: z.number().finite().nonnegative(),
        minimumShards: z.number().finite().nonnegative(),
        cycleMs: z.number().finite().nonnegative(),
      })
      .strict(),
    influence: z
      .object({
        nerve: z.number().finite().nonnegative(),
        cash: z.number().finite().nonnegative(),
        points: z.number().finite().nonnegative(),
      })
      .strict(),
    login: z
      .object({
        cashPerDay: z.number().finite().nonnegative(),
        streakCap: z.number().finite().nonnegative(),
        marks: z.number().finite().nonnegative(),
      })
      .strict(),
    mission: z
      .object({
        daily: z
          .object({
            cash: z.number().finite().nonnegative(),
            xp: z.number().finite().nonnegative(),
            shards: z.number().finite().nonnegative(),
          })
          .strict(),
        weekly: z
          .object({
            cash: z.number().finite().nonnegative(),
            xp: z.number().finite().nonnegative(),
            shards: z.number().finite().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    cosmeticCost: z.number().finite().nonnegative(),
    tickMs: z.number().finite().nonnegative(),
    sessionDays: z.number().finite().nonnegative(),
    attackCooldownMs: z.number().finite().nonnegative(),
    protectionMs: z.number().finite().nonnegative(),
    retaliationMs: z.number().finite().nonnegative(),
    dailyAttackCap: z.number().finite().nonnegative(),
    masteryRuns: z.number().finite().nonnegative(),
    maxLevel: z.number().finite().nonnegative(),
    seasonMs: z.number().finite().nonnegative(),
    maxCrew: z.number().finite().nonnegative(),
    bossHealth: z.number().finite().nonnegative(),
    worldBossHealth: z.number().finite().nonnegative(),
    holdingPeriodMs: z.number().finite().nonnegative(),
    holdingStorageHours: z.number().finite().nonnegative(),
    dailyMission: z.number().finite().nonnegative(),
    weeklyMission: z.number().finite().nonnegative(),
    curves: z
      .object({
        xpBase: z.number().positive(),
        xpExponent: z.number().positive(),
        holdingCostBase: z.number().positive(),
        holdingGrowth: z.number().min(1),
        holdingIncomeBase: z.number().int().positive(),
        crewBase: z.number().positive(),
        crewGrowth: z.number().min(1),
        regenBase: z.number().positive(),
        regenExponent: z.number().positive(),
      })
      .strict(),
  })
  .strict();
export const balance = balanceSchema.parse(raw);
