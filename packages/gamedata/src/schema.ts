/** Validate all authored content and references before builds and database seeds. */
import { z } from "zod";
import raw from "./content.json" with { type: "json" };
import rawChronicle from "./chronicle.json" with { type: "json" };
const id = z.string().regex(/^[a-z][a-z0-9-]*$/),
  n = z.number().int().nonnegative(),
  positive = n.positive();
export const contentSchema = z.object({
  eras: z.array(
    z.object({
      id: n,
      name: z.string(),
      region: z.string(),
      faction: z.string(),
      accent: z.string().regex(/^#[0-9a-f]{6}$/i),
      level: positive,
    }),
  ),
  items: z.array(
    z.object({
      id,
      name: z.string(),
      slot: z.enum(["attack", "defense", "support"]),
      era: n,
      attack: n,
      defense: n,
      rarity: positive,
      price: positive,
    }),
  ),
  jobs: z.array(
    z.object({
      id,
      name: z.string(),
      era: n,
      energy: positive,
      xp: positive,
      cash: positive,
      requires: id.nullable(),
      previous: id.nullable(),
    }),
  ),
});
const metric = z.enum(["operations", "audits", "cycles", "holdings"]);
export const chronicleContentSchema = z.object({
  offline: z.object({
    fullHours: positive,
    maximumHours: positive,
    reducedRate: z.number().min(0).max(1).multipleOf(0.01),
    reportAfterMs: positive,
  }),
  operation: z.object({
    durationMs: positive,
    cautiousChance: z.number().min(0).max(1),
    boldChance: z.number().min(0).max(1),
    boldMultiplier: z.number().positive(),
    failureCashFraction: z.number().min(0).max(1),
  }),
  prestige: z.object({
    masteryRequired: positive,
    minimumHours: positive,
    multiplierPerAsh: z.number().positive().multipleOf(0.01),
  }),
  ledger: z.object({
    auditNerve: positive,
    auditEntries: positive,
    forgeNerve: positive,
    forgeCash: positive,
    forgeHeat: positive,
    redactCost: positive,
    redactHeat: positive,
    investigationThreshold: positive,
    fine: positive,
  }),
  threat: z.object({
    intervalMs: positive,
    maximum: positive,
    incomePenalty: z.number().min(0).max(0.1).multipleOf(0.01),
    suppressStamina: positive,
  }),
  crew: z.array(
    z.object({
      id,
      name: z.string(),
      era: n,
      trait: z.enum(["principled", "daring", "methodical"]),
      loyalty: n.max(100),
      memoryGate: positive,
      operation: id,
    }),
  ),
  holdings: z.array(
    z.object({
      id,
      name: z.string(),
      era: n,
      x: n,
      y: n,
      neighbors: z.array(id),
    }),
  ),
  lore: z.array(
    z.object({
      id,
      title: z.string(),
      form: z.string(),
      trigger: metric,
      threshold: positive,
      text: z.string().min(20),
    }),
  ),
  achievements: z.array(
    z.object({
      id,
      name: z.string(),
      metric,
      threshold: positive,
      material: z.enum(["ash", "iron", "brass", "ember-glass"]),
      marks: n,
    }),
  ),
  uniqueOperations: z.array(
    z.object({ id, name: z.string(), crew: id, cash: positive, xp: positive }),
  ),
  weekly: z.object({
    operations: positive,
    crewRequired: positive,
    cash: positive,
    xp: positive,
  }),
  network: z.object({
    adjacencyBonus: z.number().min(0).max(0.5).multipleOf(0.01),
    linkCost: positive,
  }),
  crewRules: z.object({
    refusalBelow: n,
    defectBelow: n,
    boldLoss: positive,
    cautiousGain: positive,
    reassureCost: positive,
    reassureGain: positive,
  }),
});
export function validateContent(
  base: unknown = raw,
  extended: unknown = rawChronicle,
) {
  const content = contentSchema.parse(base),
    chronicle = chronicleContentSchema.parse(extended);
  for (const list of [
    content.eras,
    content.items,
    content.jobs,
    chronicle.crew,
    chronicle.holdings,
    chronicle.lore,
    chronicle.achievements,
    chronicle.uniqueOperations,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw new Error("Duplicate content ID");
  for (const item of [
    ...content.items,
    ...content.jobs,
    ...chronicle.crew,
    ...chronicle.holdings,
  ])
    if (!content.eras.some((e) => e.id === item.era))
      throw new Error("Unknown era");
  for (const job of content.jobs) {
    if (job.requires && !content.items.some((i) => i.id === job.requires))
      throw new Error("Unknown item requirement");
    let current: typeof job | undefined = job;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current.id)) throw new Error("Operation dependency cycle");
      seen.add(current.id);
      const prior: string | null = current.previous;
      current = prior ? content.jobs.find((j) => j.id === prior) : undefined;
      if (prior && !current) throw new Error("Unknown prior operation");
    }
  }
  for (const h of chronicle.holdings)
    for (const neighbor of h.neighbors)
      if (
        !chronicle.holdings.some(
          (x) => x.id === neighbor && x.neighbors.includes(h.id),
        )
      )
        throw new Error("Supply adjacency must be reciprocal");
  for (const op of chronicle.uniqueOperations)
    if (!chronicle.crew.some((c) => c.id === op.crew && c.operation === op.id))
      throw new Error("Crew operation reference invalid");
  if (chronicle.offline.fullHours > chronicle.offline.maximumHours)
    throw new Error("Offline cap invalid");
  return { content, chronicle };
}
export const validated = validateContent();
