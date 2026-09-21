/** Authoritative projections for UI. Clients display these values without settling resources or rewards. */
import { z } from "zod";
import { chronicleData as data } from "../../gamedata/src/index.ts";
import { caps, power } from "./index.ts";
import type { PlayerState } from "./index.ts";
import { networkFactor } from "./chronicle.ts";
export const deskSchema = z.object({
  caps: z.object({
    energy: z.number(),
    stamina: z.number(),
    health: z.number(),
    nerve: z.number(),
  }),
  attack: z.number(),
  defense: z.number(),
  mastery: z.number(),
  ashGain: z.number(),
  ashEligible: z.boolean(),
  ashReadyAt: z.number(),
  network: z.array(z.object({ era: z.number(), multiplier: z.number() })),
});
export type DeskProjection = z.infer<typeof deskSchema>;
export function deskProjection(s: PlayerState, now: number): DeskProjection {
  const mastery = Object.values(s.mastery).reduce((a, b) => a + b, 0);
  return {
    caps: caps(s),
    attack: Math.floor(power(s)),
    defense: Math.floor(power(s, true)),
    mastery,
    ashGain: Math.floor(mastery / data.prestige.masteryRequired),
    ashEligible:
      mastery >= data.prestige.masteryRequired &&
      now - s.chronicle.cycleStartedAt >=
        data.prestige.minimumHours * 3600000 &&
      !s.chronicle.operation,
    ashReadyAt:
      s.chronicle.cycleStartedAt + data.prestige.minimumHours * 3600000,
    network: data.holdings.map((h) => ({
      era: h.era,
      multiplier: networkFactor(s, h.era, now),
    })),
  };
}
