/** Authoritative game reducer. Pure except supplied RNG; clocks and rewards are always server-owned. */
import { z } from "zod";
import {
  balance,
  items,
  jobs,
  eras,
  xpNeeded,
  crewCost,
  holdingCost,
  regenUpgradeCost,
  eventAt,
  seasonAt,
} from "../../gamedata/src/index.ts";
import { chronicleSchema, initialChronicle } from "./chronicle-schema.ts";
import {
  initializeChronicle,
  weightedAge,
  tickHoldings,
  tickChronicle,
} from "./chronicle.ts";
const n = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const resourcesSchema = z.object({
  energy: n,
  stamina: n,
  health: n,
  nerve: n,
});
export const stateSchema = z.object({
  chronicle: chronicleSchema.default(() => initialChronicle(0, false)),
  version: z.literal(1),
  level: n.min(1).max(balance.maxLevel),
  xp: n,
  cash: n,
  premium: n,
  skills: n,
  prestige: n,
  stats: z.object({ attack: n, defense: n, health: n, energy: n, stamina: n }),
  resources: resourcesSchema,
  regen: n.max(balance.maxRegen),
  lastTickAt: n,
  crew: z
    .array(n.max(eras.length - 1))
    .min(1)
    .max(balance.maxCrew),
  inventory: z.record(
    z.string(),
    z.object({
      quantity: n,
      upgrade: n.max(balance.maxUpgrade),
      equipped: z.boolean(),
    }),
  ),
  mastery: z.record(z.string(), n),
  salvage: n,
  shards: n,
  holdings: z.array(
    z.object({
      era: n.max(3),
      tier: n.min(1).max(balance.maxHoldingTier),
      lastAt: n,
      bank: n,
    }),
  ),
  boss: z.object({ hp: n, phase: n, wins: n, availableAt: n }),
  lastAttackAt: n,
  protectionUntil: n,
  attacks: z.record(z.string(), z.object({ day: n, count: n })),
  retaliation: z.record(z.string(), n),
  bountiesWon: n,
  influence: z.array(n).length(4),
  season: n,
  missions: z.object({
    day: n,
    week: n,
    daily: n,
    weekly: n,
    dailyClaimed: z.boolean(),
    weeklyClaimed: z.boolean(),
  }),
  streak: n,
  loginDay: z.number().int(),
  cosmetic: z.string(),
});
export type PlayerState = z.infer<typeof stateSchema>;
export const actionSchema = z
  .object({
    nonce: z.string().uuid(),
    type: z.enum([
      "job",
      "skill",
      "buy",
      "equip",
      "recruit",
      "holding",
      "collect",
      "boss",
      "attack",
      "craft",
      "upgrade",
      "salvage",
      "consume",
      "regen",
      "influence",
      "prestige",
      "login",
      "mission",
      "cosmetic",
      "bounty",
      "raid",
    ]),
    key: z.string().max(80).optional(),
    target: z.string().uuid().optional(),
    choice: z.enum(["strike", "guard", "disrupt"]).optional(),
  })
  .strict();
export type Action = z.infer<typeof actionSchema>;
export function initialState(now: number): PlayerState {
  return {
    chronicle: initialChronicle(now),
    version: 1,
    level: 1,
    xp: 0,
    cash: balance.initialCash,
    premium: 0,
    skills: 0,
    prestige: 0,
    stats: { attack: 0, defense: 0, health: 0, energy: 0, stamina: 0 },
    resources: { ...balance.initialResources },
    regen: 0,
    lastTickAt: now,
    crew: [0],
    inventory: {
      knife: { quantity: 1, upgrade: 0, equipped: true },
      coat: { quantity: 1, upgrade: 0, equipped: true },
    },
    mastery: {},
    salvage: 0,
    shards: 0,
    holdings: [],
    boss: { hp: balance.bossHealth, phase: 0, wins: 0, availableAt: 0 },
    lastAttackAt: 0,
    protectionUntil: 0,
    attacks: {},
    retaliation: {},
    bountiesWon: 0,
    influence: [0, 0, 0, 0],
    season: seasonAt(now),
    missions: {
      day: Math.floor(now / 86400000),
      week: Math.floor(now / 604800000),
      daily: 0,
      weekly: 0,
      dailyClaimed: false,
      weeklyClaimed: false,
    },
    streak: 0,
    loginDay: -1,
    cosmetic: "ember",
  };
}
export function caps(s: PlayerState) {
  return {
    energy:
      balance.initialResources.energy +
      balance.capPerLevel.energy * (s.level - 1) +
      balance.capPerSkill.energy * s.stats.energy,
    stamina:
      balance.initialResources.stamina +
      balance.capPerLevel.stamina * (s.level - 1) +
      balance.capPerSkill.stamina * s.stats.stamina,
    health:
      balance.initialResources.health +
      balance.capPerLevel.health * (s.level - 1) +
      balance.capPerSkill.health * s.stats.health,
    nerve:
      balance.initialResources.nerve +
      Math.floor(s.level / balance.capPerLevel.nerveEvery),
  };
}
export function tick(s: PlayerState, now: number) {
  initializeChronicle(s);
  const elapsed = Math.max(
    0,
    weightedAge(now - s.chronicle.lastActiveAt) -
      weightedAge(s.lastTickAt - s.chronicle.lastActiveAt),
  );
  const credit = s.chronicle.clockRemainderMs + elapsed;
  const ticks = Math.floor(credit / balance.tickMs);
  s.chronicle.clockRemainderMs = credit - ticks * balance.tickMs;
  if (ticks) {
    const cap = caps(s);
    for (const key of ["energy", "stamina", "health", "nerve"] as const) {
      const before = s.resources[key];
      s.resources[key] = Math.min(
        cap[key],
        s.resources[key] +
          ticks *
            (key === "health"
              ? balance.healthRegenBase + s.regen
              : balance.regenBase + s.regen),
      );
      s.chronicle.accrued[key] += s.resources[key] - before;
    }
  }
  s.lastTickAt = Math.max(s.lastTickAt, now);
  tickHoldings(s, now);
  tickChronicle(s, now);
  const day = Math.floor(now / 86400000),
    week = Math.floor(now / 604800000);
  if (s.missions.day !== day) {
    s.missions.day = day;
    s.missions.daily = 0;
    s.missions.dailyClaimed = false;
    s.attacks = {};
  }
  if (s.missions.week !== week) {
    s.missions.week = week;
    s.missions.weekly = 0;
    s.missions.weeklyClaimed = false;
  }
  for (const id of Object.keys(s.retaliation))
    if (s.retaliation[id] < now) delete s.retaliation[id];
  if (s.season !== seasonAt(now)) {
    s.season = seasonAt(now);
    s.influence = [0, 0, 0, 0];
  }
  return s;
}
export function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function spend(
  s: PlayerState,
  key: "cash" | "salvage" | "shards" | "premium",
  cost: number,
) {
  requireRule(
    Number.isSafeInteger(cost) && cost >= 0 && s[key] >= cost,
    `Not enough ${key}`,
  );
  s[key] -= cost;
}
export function reward(s: PlayerState, cash: number, xp: number) {
  requireRule(
    Number.isSafeInteger(cash) &&
      cash >= 0 &&
      cash <= 1_000_000 &&
      Number.isSafeInteger(xp) &&
      xp >= 0 &&
      xp <= 100_000,
    "Invalid reward",
  );
  s.cash += cash;
  s.xp += xp;
  while (s.level < balance.maxLevel && s.xp >= xpNeeded(s.level)) {
    s.xp -= xpNeeded(s.level);
    s.level++;
    s.skills += balance.skillPointsPerLevel;
  }
  if (s.level === balance.maxLevel) s.xp = Math.min(s.xp, xpNeeded(s.level));
}
export function loot(roll: number) {
  requireRule(roll >= 0 && roll < 1, "Invalid roll");
  return roll < balance.lootShardThreshold
    ? "shard"
    : roll < balance.lootSalvageThreshold
      ? "salvage"
      : "none";
}
function unlocked(s: PlayerState, era: number) {
  requireRule(eras[era] && s.level >= eras[era].level, "Era is locked");
}
function resource(
  s: PlayerState,
  key: keyof PlayerState["resources"],
  amount: number,
) {
  requireRule(s.resources[key] >= amount, `Not enough ${key}`);
  s.resources[key] -= amount;
}
// Each slot has a crew-count budget; choose best equipped copies, affinity adds at most 10%.
export function power(s: PlayerState, defending = false) {
  let gear = 0;
  for (const slot of ["attack", "defense", "support"]) {
    const copies: number[] = [];
    for (const item of items.filter((i) => i.slot === slot)) {
      const inv = s.inventory[item.id];
      if (!inv?.equipped) continue;
      const affinity =
        s.crew.filter((e) => e === item.era).length / s.crew.length;
      for (let i = 0; i < Math.min(inv.quantity, s.crew.length); i++)
        copies.push(
          (defending ? item.defense : item.attack) *
            (1 + inv.upgrade * balance.gearUpgradeMultiplier) *
            (1 + affinity * balance.affinityMultiplier),
        );
    }
    gear += copies
      .sort((a, b) => b - a)
      .slice(0, s.crew.length)
      .reduce((a, b) => a + b, 0);
  }
  return (
    (balance.basePower +
      s.level * balance.powerPerLevel +
      balance.powerPerSkill * (defending ? s.stats.defense : s.stats.attack) +
      gear) *
    (1 + s.prestige * balance.prestigeMultiplier)
  );
}
export function combat(attack: number, defense: number, roll: number) {
  requireRule(
    attack > 0 && defense > 0 && roll >= 0 && roll < 1,
    "Invalid combat input",
  );
  const ratio =
    (attack / defense) * (balance.varianceMin + roll * balance.varianceRange);
  return {
    won: ratio >= 1,
    damage: Math.max(
      balance.minDamage,
      Math.min(balance.maxDamage, Math.floor(balance.baseDamage * ratio)),
    ),
  };
}
export function applyAction(
  s: PlayerState,
  action: Action,
  now: number,
  rng: () => number,
  target?: PlayerState,
) {
  tick(s, now);
  const key = action.key ?? "";
  let message = "Action completed";
  switch (action.type) {
    case "job": {
      const job = jobs.find((j) => j.id === key);
      requireRule(job, "Unknown operation");
      unlocked(s, job.era);
      requireRule(
        !job.requires || (s.inventory[job.requires]?.quantity ?? 0) > 0,
        "Required equipment missing",
      );
      requireRule(
        !job.previous || (s.mastery[job.previous] ?? 0) >= balance.masteryRuns,
        "Master previous operation first",
      );
      resource(s, "energy", job.energy);
      const mastery = s.mastery[key] ?? 0;
      const tier = Math.min(3, Math.floor(mastery / balance.masteryRuns));
      reward(
        s,
        Math.floor(
          job.cash *
            (1 + tier * balance.masteryTierBonus) *
            eventAt(now).multiplier,
        ),
        job.xp,
      );
      s.mastery[key] = Math.min(balance.masteryCap, mastery + 1);
      s.missions.daily++;
      s.missions.weekly++;
      const drop = loot(rng());
      if (drop === "shard") s.shards++;
      if (drop === "salvage") s.salvage += balance.lootSalvage;
      message = `${job.name} complete · ${drop === "none" ? "route secured" : drop + " recovered"}`;
      break;
    }
    case "skill": {
      requireRule(
        ["attack", "defense", "health", "energy", "stamina"].includes(key),
        "Unknown skill",
      );
      requireRule(s.skills > 0, "No skill points");
      s.skills--;
      s.stats[key as keyof PlayerState["stats"]]++;
      break;
    }
    case "buy": {
      const item = items.find((i) => i.id === key);
      requireRule(item, "Unknown item");
      unlocked(s, item.era);
      spend(s, "cash", item.price);
      const inv = s.inventory[key] ?? {
        quantity: 0,
        upgrade: 0,
        equipped: false,
      };
      requireRule(inv.quantity < balance.maxStack, "Inventory stack full");
      inv.quantity++;
      s.inventory[key] = inv;
      break;
    }
    case "equip": {
      requireRule(s.inventory[key]?.quantity, "Item not owned");
      const item = items.find((i) => i.id === key);
      requireRule(item, "Unknown item");
      if (!s.inventory[key].equipped) unlocked(s, item.era);
      s.inventory[key].equipped = !s.inventory[key].equipped;
      break;
    }
    case "recruit": {
      const era = Number(key);
      unlocked(s, era);
      requireRule(s.crew.length < balance.maxCrew, "Crew cap reached");
      spend(s, "cash", crewCost(s.crew.length));
      s.crew.push(era);
      break;
    }
    case "holding": {
      const era = Number(key);
      unlocked(s, era);
      const h = s.holdings.find((h) => h.era === era);
      requireRule(
        !h || h.tier < balance.maxHoldingTier,
        "Holding at maximum tier",
      );
      spend(s, "cash", holdingCost(h?.tier ?? 0, era));
      if (h) h.tier++;
      else s.holdings.push({ era, tier: 1, lastAt: now, bank: 0 });
      break;
    }
    case "collect": {
      const h = s.holdings.find((h) => h.era === Number(key));
      requireRule(h && h.bank > 0, "No stored income");
      const net = Math.floor(h.bank * (1 - balance.holdingUpkeep));
      reward(s, net, 0);
      h.bank = 0;
      message = `Collected ${net} crowns after 10% upkeep`;
      break;
    }
    case "regen":
      spend(s, "cash", regenUpgradeCost(s.regen));
      requireRule(s.regen < balance.maxRegen, "Regen capped");
      s.regen++;
      break;
    case "craft": {
      const item = items.find((i) => i.id === key);
      requireRule(item, "Unknown recipe");
      unlocked(s, item.era);
      spend(s, "salvage", balance.craftSalvageBase * (item.era + 1));
      spend(s, "shards", item.era);
      const inv = s.inventory[key] ?? {
        quantity: 0,
        upgrade: 0,
        equipped: false,
      };
      requireRule(inv.quantity < balance.maxStack, "Inventory stack full");
      inv.quantity++;
      s.inventory[key] = inv;
      break;
    }
    case "upgrade": {
      const inv = s.inventory[key];
      requireRule(
        inv?.quantity && inv.upgrade < balance.maxUpgrade,
        "Cannot upgrade",
      );
      spend(s, "salvage", balance.upgradeSalvageBase * (inv.upgrade + 1));
      spend(s, "shards", Math.floor(inv.upgrade / balance.upgradeShardEvery));
      inv.upgrade++;
      break;
    }
    case "salvage": {
      const inv = s.inventory[key];
      requireRule(inv?.quantity && !inv.equipped, "Unequip before salvaging");
      inv.quantity--;
      s.salvage += balance.salvagePerCopy;
      break;
    }
    case "consume":
      spend(s, "cash", balance.tonicCost);
      s.resources.health = Math.min(
        caps(s).health,
        s.resources.health + balance.tonicHealing,
      );
      break;
    case "boss": {
      requireRule(now >= s.boss.availableAt, "Boss reforming");
      requireRule(
        s.resources.health > balance.solo.minimumHealth,
        "Heal before fighting",
      );
      resource(s, "stamina", balance.solo.stamina);
      const phase =
        s.boss.hp > balance.solo.phaseThresholds[0]
          ? 0
          : s.boss.hp > balance.solo.phaseThresholds[1]
            ? 1
            : 2;
      const correct =
        action.choice === (["strike", "guard", "disrupt"] as const)[phase];
      const damage = Math.floor(
        power(s) *
          (correct
            ? balance.solo.correctMultiplier
            : balance.solo.wrongMultiplier),
      );
      s.boss.hp = Math.max(0, s.boss.hp - damage);
      s.resources.health = Math.max(
        0,
        s.resources.health -
          (correct ? balance.solo.correctDamage : balance.solo.wrongDamage),
      );
      s.boss.phase =
        s.boss.hp > balance.solo.phaseThresholds[0]
          ? 0
          : s.boss.hp > balance.solo.phaseThresholds[1]
            ? 1
            : 2;
      message = `Glasswrit Sentinel takes ${damage} damage`;
      if (!s.boss.hp) {
        s.boss.wins++;
        reward(s, balance.solo.cash, balance.solo.xp);
        s.shards += balance.solo.shards;
        s.salvage += balance.solo.salvage;
        s.boss.hp = balance.bossHealth;
        s.boss.phase = 0;
        s.boss.availableAt = now + balance.solo.cooldownMs;
        message = "Sentinel defeated · 200 crowns, 70 XP, 2 shards";
      }
      break;
    }
    case "attack":
    case "raid": {
      requireRule(target && action.target, "Target required");
      tick(target, now);
      requireRule(
        Math.abs(s.level - target.level) <=
          Math.max(
            balance.pvp.bracketMinimum,
            Math.floor(s.level * balance.pvp.bracketFraction),
          ),
        "Outside level bracket",
      );
      requireRule(
        now - s.lastAttackAt >= balance.attackCooldownMs,
        "Attack cooling down",
      );
      requireRule(target.protectionUntil <= now, "Target protected");
      requireRule(
        s.resources.health > balance.pvp.minimumHealth &&
          target.resources.health > 0,
        "Combatant needs healing",
      );
      const count = s.attacks[action.target]?.count ?? 0;
      requireRule(count < balance.dailyAttackCap, "Daily target cap");
      resource(s, "stamina", balance.pvp.stamina);
      s.lastAttackAt = now;
      s.attacks[action.target] = {
        day: Math.floor(now / 86400000),
        count: count + 1,
      };
      const retaliating = (s.retaliation[action.target] ?? 0) > now;
      const result = combat(
        power(s) * (retaliating ? balance.pvp.retaliationMultiplier : 1),
        power(target, true),
        rng(),
      );
      s.resources.health = Math.max(
        0,
        s.resources.health -
          (result.won ? balance.pvp.winDamage : balance.pvp.lossDamage),
      );
      target.resources.health = Math.max(
        0,
        target.resources.health - result.damage,
      );
      target.protectionUntil = now + balance.protectionMs;
      message = result.won ? "Duel won" : "Duel lost";
      if (result.won) {
        const stolen = Math.min(
          balance.pvp.maxStolen,
          Math.floor(target.cash * balance.pvp.stolenFraction),
        );
        target.cash -= stolen;
        reward(s, stolen, balance.pvp.xp);
        if (action.type === "raid") {
          const h = target.holdings.find((h) => h.bank > 0);
          if (h) {
            const raid = Math.floor(h.bank * balance.pvp.raidFraction);
            h.bank -= raid;
            reward(s, raid, 0);
            message += ` · raided ${raid} stored crowns`;
          }
        }
      }
      break;
    }
    case "influence": {
      const era = Number(key);
      unlocked(s, era);
      resource(s, "nerve", balance.influence.nerve);
      spend(s, "cash", balance.influence.cash);
      s.influence[era] += balance.influence.points;
      break;
    }
    case "prestige":
      requireRule(
        s.level >= balance.prestigeLevel,
        "Ascension requires level 30",
      );
      s.prestige++;
      s.level = 1;
      s.xp = 0;
      s.skills = 0;
      s.stats = { attack: 0, defense: 0, health: 0, energy: 0, stamina: 0 };
      s.resources = caps(s);
      for (const inv of Object.values(s.inventory)) inv.equipped = false;
      message = "Ascended · +3% permanent combat power";
      break;
    case "login": {
      const day = Math.floor(now / 86400000);
      requireRule(s.loginDay !== day, "Already claimed today");
      s.streak = s.loginDay === day - 1 ? s.streak + 1 : 1;
      s.loginDay = day;
      reward(
        s,
        balance.login.cashPerDay * Math.min(balance.login.streakCap, s.streak),
        0,
      );
      s.premium += balance.login.marks;
      break;
    }
    case "mission": {
      const weekly = key === "weekly";
      requireRule(
        weekly
          ? s.missions.weekly >= balance.weeklyMission &&
              !s.missions.weeklyClaimed
          : s.missions.daily >= balance.dailyMission &&
              !s.missions.dailyClaimed,
        "Mission not claimable",
      );
      if (weekly) s.missions.weeklyClaimed = true;
      else s.missions.dailyClaimed = true;
      const prize = weekly ? balance.mission.weekly : balance.mission.daily;
      reward(s, prize.cash, prize.xp);
      s.shards += prize.shards;
      break;
    }
    case "cosmetic":
      requireRule(
        ["ember", "tide", "violet"].includes(key),
        "Unknown cosmetic",
      );
      spend(s, "premium", balance.cosmeticCost);
      s.cosmetic = key;
      break;
    case "bounty":
      throw new Error("Bounty escrow must be handled by transactional service");
  }
  stateSchema.parse(s);
  if (target) stateSchema.parse(target);
  return message;
}
