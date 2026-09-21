/** Server-owned retention systems. Never settle a client clock or accept client rewards. */
import { z } from "zod";
import {
  chronicleData as data,
  balance,
  jobs,
  eras,
  holdingIncome,
} from "../../gamedata/src/index.ts";
import { initialChronicle, emptyGains } from "./chronicle-schema.ts";
import { applyAction, requireRule, reward, spend, caps } from "./index.ts";
import type { PlayerState, Action } from "./index.ts";
const hour = 3600000;
export function initializeChronicle(s: PlayerState) {
  if (!s.chronicle.initialized) s.chronicle = initialChronicle(s.lastTickAt);
}
// Difference of cumulative weighted time, rather than rounding each job's elapsed time.
export function weightedAge(age: number) {
  const h = Math.max(0, age) / hour;
  return (
    (Math.min(h, data.offline.fullHours) +
      Math.max(
        0,
        Math.min(h, data.offline.maximumHours) - data.offline.fullHours,
      ) *
        data.offline.reducedRate) *
    hour
  );
}
export function accruedQuanta(
  from: number,
  to: number,
  anchor: number,
  quantum: number,
) {
  return Math.max(
    0,
    Math.floor(weightedAge(to - anchor) / quantum) -
      Math.floor(weightedAge(from - anchor) / quantum),
  );
}
export function pressureAt(s: PlayerState, now: number) {
  const c = s.chronicle;
  return Math.min(
    data.threat.maximum,
    c.pressure +
      Math.max(
        0,
        Math.floor((now - c.threatNextAt) / data.threat.intervalMs) + 1,
      ),
  );
}
export function networkFactor(s: PlayerState, era: number, now: number) {
  const node = data.holdings.find((h) => h.era === era);
  const neighbors =
    node?.neighbors.filter((id) => {
      const adjacent = data.holdings.find((h) => h.id === id)!;
      return (
        s.holdings.some((h) => h.era === adjacent.era) &&
        s.chronicle.links.includes([node.id, id].sort().join(":"))
      );
    }).length ?? 0;
  return (
    (1 + neighbors * data.network.adjacencyBonus) *
    (1 - pressureAt(s, now) * data.threat.incomePenalty)
  );
}
export function tickHoldings(s: PlayerState, now: number) {
  const c = s.chronicle;
  const denominator = BigInt(hour) * 100n ** 4n;
  for (const h of s.holdings) {
    if (now <= h.lastAt) continue;
    const stop = Math.min(
      now,
      c.lastActiveAt + data.offline.maximumHours * hour,
    );
    const node = data.holdings.find((n) => n.era === h.era);
    const adjacent =
      node?.neighbors.filter((id) => {
        const other = data.holdings.find((n) => n.id === id)!;
        return (
          s.holdings.some((x) => x.era === other.era) &&
          c.links.includes([node.id, id].sort().join(":"))
        );
      }).length ?? 0;
    let numerator = BigInt(c.holdingRemainders[String(h.era)] ?? "0");
    for (let at = h.lastAt; at < stop;) {
      const fullUntil = c.lastActiveAt + data.offline.fullHours * hour;
      const nextThreat =
        c.threatNextAt +
        Math.max(
          0,
          Math.floor((at - c.threatNextAt) / data.threat.intervalMs) + 1,
        ) *
          data.threat.intervalMs;
      const end = Math.min(stop, fullUntil > at ? fullUntil : stop, nextThreat);
      const rate =
        at < fullUntil ? 100 : Math.round(data.offline.reducedRate * 100);
      const supply =
          100 + Math.round(adjacent * data.network.adjacencyBonus * 100),
        pressure =
          100 - Math.round(pressureAt(s, at) * data.threat.incomePenalty * 100),
        ash = 100 + Math.round(c.ash * data.prestige.multiplierPerAsh * 100);
      numerator +=
        BigInt(holdingIncome(h.tier, h.era)) *
        BigInt(end - at) *
        BigInt(rate) *
        BigInt(supply) *
        BigInt(pressure) *
        BigInt(ash);
      at = end;
    }
    const income = Number(numerator / denominator);
    c.holdingRemainders[String(h.era)] = (numerator % denominator).toString();
    const before = h.bank;
    h.bank = Math.min(
      holdingIncome(h.tier, h.era) * balance.holdingStorageHours,
      h.bank + income,
    );
    c.accrued.income += h.bank - before;
    h.lastAt = now;
  }
}
export function tickChronicle(s: PlayerState, now: number) {
  const c = s.chronicle;
  const advanced = Math.max(
    0,
    Math.floor((now - c.threatNextAt) / data.threat.intervalMs) + 1,
  );
  if (advanced) {
    const before = c.pressure;
    c.pressure = Math.min(data.threat.maximum, c.pressure + advanced);
    c.accrued.escalations += c.pressure - before;
    c.threatNextAt += advanced * data.threat.intervalMs;
  }
  const week = Math.floor(now / 604800000);
  if (c.weeklyBucket !== week) {
    c.weeklyBucket = week;
    c.weeklyOps = 0;
    c.weeklyClaimed = false;
  }
  unlockChronicle(s);
}
export function arrive(s: PlayerState, now: number) {
  const c = s.chronicle;
  const gap = now - c.lastActiveAt;
  if (gap >= data.offline.reportAfterMs) {
    const gains = { ...c.accrued };
    if (c.report)
      for (const k of Object.keys(gains) as (keyof typeof gains)[])
        gains[k] += c.report.gains[k];
    c.report = {
      id: String(++c.sequence),
      from: c.report?.from ?? c.lastActiveAt,
      to: now,
      gains,
    };
    c.accrued = emptyGains();
  } else c.accrued = emptyGains();
  c.lastActiveAt = Math.max(c.lastActiveAt, now);
}
export function ledgerEntry(
  s: PlayerState,
  action: string,
  text: string,
  now: number,
  status: "intact" | "forged" = "intact",
) {
  const c = s.chronicle;
  c.entries.push({ id: String(++c.sequence), at: now, action, text, status });
  c.entries = c.entries.slice(-100);
  unlockChronicle(s);
}
export function unlockChronicle(s: PlayerState) {
  const c = s.chronicle;
  const metrics = { ...c.totals, holdings: s.holdings.length };
  for (const entry of data.lore)
    if (metrics[entry.trigger] >= entry.threshold && !c.lore.includes(entry.id))
      c.lore.push(entry.id);
  for (const badge of data.achievements)
    if (
      metrics[badge.metric] >= badge.threshold &&
      !c.badges.includes(badge.id)
    ) {
      c.badges.push(badge.id);
      s.premium += badge.marks;
    }
}
export const featureSchema = z
  .object({
    nonce: z.uuid(),
    type: z.enum([
      "operation-start",
      "operation-resolve",
      "report-ack",
      "ledger-audit",
      "ledger-forge",
      "ledger-redact",
      "crew-reassure",
      "crew-recruit",
      "network-link",
      "threat-suppress",
      "ash-cycle",
      "weekly-crew",
    ]),
    key: z.string().max(80).optional(),
    approach: z.enum(["cautious", "bold"]).optional(),
    crewId: z.string().max(40).optional(),
  })
  .strict();
export type FeatureAction = z.infer<typeof featureSchema>;
export function startOperation(
  s: PlayerState,
  key: string,
  approach: "cautious" | "bold",
  crewId: string,
  now: number,
  rng: () => number,
) {
  const c = s.chronicle;
  requireRule(!c.operation, "Resolve the operation already on your desk");
  const member = c.companions.find((x) => x.id === crewId && !x.defected);
  requireRule(member, "Select a loyal crew member");
  requireRule(
    member.loyalty >= data.crewRules.refusalBelow,
    "Crew member refuses: restore loyalty first",
  );
  const job = jobs.find((j) => j.id === key),
    unique = data.uniqueOperations.find((j) => j.id === key);
  requireRule(job || unique, "Unknown operation");
  if (job) {
    requireRule(s.level >= eras[job.era].level, "Era is locked");
    requireRule(
      !job.requires || (s.inventory[job.requires]?.quantity ?? 0) > 0,
      "Required equipment missing",
    );
    requireRule(
      !job.previous || (s.mastery[job.previous] ?? 0) >= balance.masteryRuns,
      "Master previous operation first",
    );
  } else {
    const definition = data.crew.find((x) => x.id === unique!.crew)!;
    requireRule(
      member.id === definition.id && member.successes >= definition.memoryGate,
      "Crew history has not unlocked this operation",
    );
  }
  const energy = job?.energy ?? 8;
  requireRule(s.resources.energy >= energy, "Not enough energy");
  s.resources.energy -= energy;
  c.operation = {
    id: key,
    readyAt: now + data.operation.durationMs,
    approach,
    crewId,
    energy,
    kind: job ? "standard" : "unique",
    roll: rng(),
  };
  c.resolution = null;
  return `${job?.name ?? unique!.name} underway`;
}
export function resolveOperation(
  s: PlayerState,
  now: number,
  rng: () => number = () => 0.99,
) {
  const c = s.chronicle,
    op = c.operation;
  requireRule(op, "No operation awaiting resolution");
  requireRule(now >= op.readyAt, "Operation is still underway");
  const member = c.companions.find((x) => x.id === op.crewId)!;
  const success =
    op.roll <
    (op.approach === "bold"
      ? data.operation.boldChance
      : data.operation.cautiousChance);
  const cashBefore = s.cash,
    xpBefore = s.xp,
    levelBefore = s.level;
  const job = jobs.find((j) => j.id === op.id),
    unique = data.uniqueOperations.find((j) => j.id === op.id);
  let earnedXp = 0;
  if (success) {
    if (job) {
      s.resources.energy += op.energy;
      applyAction(
        s,
        {
          nonce: "00000000-0000-4000-8000-000000000000",
          type: "job",
          key: job.id,
        } as Action,
        now,
        rng,
      );
      earnedXp = job.xp;
    } else {
      reward(s, unique!.cash, unique!.xp);
      earnedXp = unique!.xp;
      s.missions.daily++;
      s.missions.weekly++;
    }
    const baseEarned = s.cash - cashBefore;
    const multiplier =
      (op.approach === "bold" ? data.operation.boldMultiplier : 1) *
      (1 + c.ash * data.prestige.multiplierPerAsh);
    reward(s, Math.floor(baseEarned * (multiplier - 1)), 0);
    member.successes++;
    c.weeklyOps++;
  } else
    reward(
      s,
      Math.floor(
        (job?.cash ?? unique!.cash) * data.operation.failureCashFraction,
      ),
      0,
    );
  c.totals.operations++;
  const definition = data.crew.find((x) => x.id === member.id)!;
  member.loyalty = Math.max(
    0,
    Math.min(
      100,
      member.loyalty +
        (op.approach === "bold" && definition.trait !== "daring"
          ? -data.crewRules.boldLoss
          : data.crewRules.cautiousGain),
    ),
  );
  member.memories.push(
    `${success ? "Secured" : "Lost"} ${op.id} / ${op.approach}`,
  );
  member.memories = member.memories.slice(-12);
  if (member.loyalty < data.crewRules.defectBelow) member.defected = true;
  c.operation = null;
  c.resolution = {
    title: job?.name ?? unique!.name,
    success,
    cash: s.cash - cashBefore,
    xp: earnedXp,
    text: success
      ? "The route held. Your clerk sealed the proceeds."
      : "The route failed. A partial payment survived.",
  };
  if (s.level === levelBefore)
    requireRule(s.xp >= xpBefore, "Invalid XP settlement");
  unlockChronicle(s);
  return `Operation ${success ? "complete" : "failed"} · ${c.resolution.cash} crowns · ${earnedXp} XP`;
}
export function applyFeature(
  s: PlayerState,
  a: FeatureAction,
  now: number,
  rng: () => number,
) {
  const c = s.chronicle;
  const key = a.key ?? "";
  switch (a.type) {
    case "operation-start":
      return startOperation(
        s,
        key,
        a.approach ?? "cautious",
        a.crewId ?? c.companions[0].id,
        now,
        rng,
      );
    case "operation-resolve":
      return resolveOperation(s, now, rng);
    case "report-ack":
      requireRule(
        c.report?.id === key,
        "Report has changed; refresh before acknowledging",
      );
      c.report = null;
      return "Ember Ledger report filed";
    case "ledger-audit": {
      const entries = c.entries
        .filter((e) => e.status === "intact" || e.status === "forged")
        .slice(0, data.ledger.auditEntries);
      requireRule(entries.length, "No unaudited entries");
      requireRule(
        s.resources.nerve >= data.ledger.auditNerve,
        "Not enough nerve",
      );
      s.resources.nerve -= data.ledger.auditNerve;
      for (const entry of entries) {
        if (entry.status === "forged") {
          s.cash = Math.max(0, s.cash - data.ledger.fine);
          c.heat = Math.max(0, c.heat - 20);
        }
        entry.status = "audited";
      }
      c.totals.audits++;
      s.salvage += entries.length;
      for (const member of c.companions)
        if (!member.defected)
          member.loyalty = Math.min(100, member.loyalty + 2);
      return "Audit sealed; forged entries incur a fine";
    }
    case "ledger-forge":
      requireRule(
        s.resources.nerve >= data.ledger.forgeNerve,
        "Not enough nerve",
      );
      s.resources.nerve -= data.ledger.forgeNerve;
      reward(s, data.ledger.forgeCash, 0);
      c.heat += data.ledger.forgeHeat;
      for (const m of c.companions)
        if (data.crew.find((d) => d.id === m.id)?.trait === "principled") {
          m.loyalty = Math.max(0, m.loyalty - 20);
          if (m.loyalty < data.crewRules.defectBelow) m.defected = true;
        }
      if (c.heat >= data.ledger.investigationThreshold) {
        s.cash = Math.max(0, s.cash - data.ledger.fine);
        c.pressure = Math.min(data.threat.maximum, c.pressure + 1);
        c.heat = 50;
        return "Investigation opened: fine paid; rival pressure increased";
      }
      return "Forged proceeds entered; suspicion rises";
    case "ledger-redact": {
      const entry = c.entries.find((e) => e.id === key);
      requireRule(
        entry && entry.status !== "redacted",
        "Choose an existing entry",
      );
      spend(s, "cash", data.ledger.redactCost);
      entry.text = "[REDACTED]";
      entry.status = "redacted";
      c.heat = Math.max(0, c.heat - data.ledger.redactHeat);
      return "Entry redacted in the playable ledger; server audit remains intact";
    }
    case "crew-reassure": {
      const member = c.companions.find((m) => m.id === key);
      requireRule(member && !member.defected, "Member has left the syndicate");
      spend(s, "cash", data.crewRules.reassureCost);
      member.loyalty = Math.min(
        100,
        member.loyalty + data.crewRules.reassureGain,
      );
      return "A private conversation restored loyalty";
    }
    case "crew-recruit": {
      const def = data.crew.find((x) => x.id === key);
      requireRule(
        def && s.level >= eras[def.era].level,
        "Crew contact is locked",
      );
      const previous = c.companions.find((x) => x.id === key);
      requireRule(!previous || previous.defected, "Contact already recorded");
      spend(s, "cash", previous ? 200 : 100);
      if (previous) {
        previous.defected = false;
        previous.loyalty = def.loyalty;
        return `${def.name} returned under a new contract`;
      }
      c.companions.push({
        id: def.id,
        loyalty: def.loyalty,
        memories: [],
        successes: 0,
        defected: false,
      });
      return `${def.name} joined your desk`;
    }
    case "network-link": {
      const [one, two] = key.split(":");
      const first = data.holdings.find((h) => h.id === one),
        second = data.holdings.find((h) => h.id === two);
      requireRule(
        first && second && first.neighbors.includes(two),
        "Only adjacent holdings can be supplied",
      );
      requireRule(
        s.holdings.some((h) => h.era === first.era) &&
          s.holdings.some((h) => h.era === second.era),
        "Build both holdings first",
      );
      const link = [one, two].sort().join(":");
      requireRule(!c.links.includes(link), "Supply line already active");
      spend(s, "cash", data.network.linkCost);
      c.links.push(link);
      return "Supply line established; linked income increases";
    }
    case "threat-suppress":
      requireRule(c.pressure > 0, "No faction pressure to suppress");
      requireRule(
        s.resources.stamina >= data.threat.suppressStamina,
        "Not enough stamina",
      );
      s.resources.stamina -= data.threat.suppressStamina;
      c.pressure--;
      return "The Glasswrit Office withdrew one escalation";
    case "ash-cycle": {
      requireRule(
        !c.operation,
        "Resolve your operation before closing the cycle",
      );
      const mastery = Object.values(s.mastery).reduce(
        (sum, value) => sum + value,
        0,
      );
      requireRule(
        mastery >= data.prestige.masteryRequired,
        "More operation mastery required",
      );
      requireRule(
        now - c.cycleStartedAt >= data.prestige.minimumHours * hour,
        "The first ledger must age four hours",
      );
      const earned = Math.max(
        1,
        Math.floor(mastery / data.prestige.masteryRequired),
      );
      c.ash += earned;
      c.totals.cycles++;
      c.cycleStartedAt = now;
      s.prestige++;
      s.mastery = {};
      s.level = 1;
      s.xp = 0;
      s.skills = 0;
      s.stats = { attack: 0, defense: 0, health: 0, energy: 0, stamina: 0 };
      s.resources = caps(s);
      for (const inv of Object.values(s.inventory)) inv.equipped = false;
      unlockChronicle(s);
      return `Ash Cycle closed · ${earned} permanent ash · lore unlocked`;
    }
    case "weekly-crew":
      requireRule(
        !c.weeklyClaimed &&
          c.weeklyOps >= data.weekly.operations &&
          s.crew.length >= data.weekly.crewRequired,
        "Weekly crew operation is not ready",
      );
      reward(s, data.weekly.cash, data.weekly.xp);
      c.weeklyClaimed = true;
      return "Weekly crew operation settled";
  }
}
