/** Build gate: reject malformed tables and broken references before shipping. */
import { validated } from "../packages/gamedata/src/schema.ts";
import "../packages/gamedata/src/balance-schema.ts";
console.log(
  `Validated ${validated.content.jobs.length} operations, ${validated.chronicle.crew.length} crew, ${validated.chronicle.lore.length} lore fragments and ${validated.chronicle.achievements.length} achievements.`,
);
