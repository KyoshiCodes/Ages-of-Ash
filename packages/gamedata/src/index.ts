/** Single balance authority. Curves are pure and capped; no client-supplied reward values. */
import { validated } from "./schema.ts";
const content = validated.content;
export const chronicleData = validated.chronicle;
export const eras = content.eras;
export const items = content.items;
export const jobs = content.jobs;
export const masteryNames = ["Bronze", "Silver", "Gold", "Mythic"] as const;
export { balance } from "./balance-schema.ts";
import { balance } from "./balance-schema.ts";
// XP is incremental: gentle first session, quadratic total XP as levels rise.
export const xpNeeded = (level: number) =>
  Math.floor(balance.curves.xpBase * level ** balance.curves.xpExponent);
// Geometric purchase/upgrade sink outruns linear early-game income.
export const holdingCost = (tier: number, era: number) =>
  Math.floor(
    balance.curves.holdingCostBase *
      balance.curves.holdingGrowth ** tier *
      (era + 1),
  );
export const holdingIncome = (tier: number, era: number) =>
  balance.curves.holdingIncomeBase * tier * (era + 1);
export const crewCost = (count: number) =>
  Math.floor(balance.curves.crewBase * balance.curves.crewGrowth ** count);
export const regenUpgradeCost = (rank: number) =>
  balance.curves.regenBase * (rank + 1) ** balance.curves.regenExponent;
export const eventAt = (now: number) => ({
  active: new Date(now).getUTCDay() === 6,
  name: "The Ember Convergence",
  multiplier: new Date(now).getUTCDay() === 6 ? 1.2 : 1,
});
export const seasonAt = (now: number) => Math.floor(now / balance.seasonMs);
