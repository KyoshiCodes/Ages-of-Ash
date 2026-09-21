/** Versioned extension to existing player saves; defaults permit explicit legacy initialization on first tick. */
import { z } from "zod";
import { chronicleData as data } from "../../gamedata/src/index.ts";
const n = z.number().int().nonnegative();
export const gainsSchema = z.object({
  energy: n,
  stamina: n,
  health: n,
  nerve: n,
  income: n,
  escalations: n,
});
export const chronicleSchema = z.object({
  initialized: z.boolean(),
  startedAt: n,
  lastActiveAt: n,
  ash: n,
  cycleStartedAt: n,
  clockRemainderMs: z.number().nonnegative(),
  holdingRemainders: z.record(z.string(), z.string().regex(/^\d+$/)),
  accrued: gainsSchema,
  report: z
    .object({ id: z.string(), from: n, to: n, gains: gainsSchema })
    .nullable(),
  entries: z
    .array(
      z.object({
        id: z.string(),
        at: n,
        action: z.string(),
        text: z.string(),
        status: z.enum(["intact", "audited", "forged", "redacted"]),
      }),
    )
    .max(100),
  sequence: n,
  heat: n,
  companions: z.array(
    z.object({
      id: z.string(),
      loyalty: n.max(100),
      memories: z.array(z.string()).max(12),
      successes: n,
      defected: z.boolean(),
    }),
  ),
  operation: z
    .object({
      id: z.string(),
      readyAt: n,
      approach: z.enum(["cautious", "bold"]),
      crewId: z.string(),
      energy: n,
      kind: z.enum(["standard", "unique"]),
      roll: z.number().min(0).lt(1),
    })
    .nullable(),
  resolution: z
    .object({
      title: z.string(),
      success: z.boolean(),
      cash: n,
      xp: n,
      text: z.string(),
    })
    .nullable(),
  links: z.array(z.string()),
  pressure: n,
  threatNextAt: n,
  totals: z.object({ operations: n, audits: n, cycles: n }),
  lore: z.array(z.string()),
  badges: z.array(z.string()),
  weeklyOps: n,
  weeklyBucket: z.number().int(),
  weeklyClaimed: z.boolean(),
  sessionId: z.string().nullable(),
});
export type Chronicle = z.infer<typeof chronicleSchema>;
export const emptyGains = () => ({
  energy: 0,
  stamina: 0,
  health: 0,
  nerve: 0,
  income: 0,
  escalations: 0,
});
export function initialChronicle(now: number, initialized = true): Chronicle {
  return {
    initialized,
    startedAt: now,
    lastActiveAt: now,
    cycleStartedAt: now,
    ash: 0,
    clockRemainderMs: 0,
    holdingRemainders: {},
    accrued: emptyGains(),
    report: null,
    entries: [],
    sequence: 0,
    heat: 0,
    companions: [
      {
        id: data.crew[0].id,
        loyalty: data.crew[0].loyalty,
        memories: [],
        successes: 0,
        defected: false,
      },
    ],
    operation: null,
    resolution: null,
    links: [],
    pressure: 0,
    threatNextAt: now + data.threat.intervalMs,
    totals: { operations: 0, audits: 0, cycles: 0 },
    lore: [],
    badges: [],
    weeklyOps: 0,
    weeklyBucket: Math.floor(now / 604800000),
    weeklyClaimed: false,
    sessionId: null,
  };
}
