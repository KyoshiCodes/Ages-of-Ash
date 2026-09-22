/** Idempotent seed. Never resets existing progression or publishes account credentials. */
import { randomUUID } from "node:crypto";
import { prisma, closeDatabase } from "./index.ts";
import { initialState, stateSchema } from "../../engine/src/index.ts";
import { initializeChronicle } from "../../engine/src/chronicle.ts";
import { canonicalCatalog } from "../../gamedata/src/catalog.ts";
import { balance } from "../../gamedata/src/index.ts";
const id = "00000000-0000-4000-8000-000000000001";
for (const entry of canonicalCatalog())
  await prisma.contentDefinition.upsert({
    where: { key: entry.key },
    create: entry,
    update: { definition: entry.definition },
  });
// Explicit upgrade of legacy aggregates; existing progression and currencies are untouched.
let cursor: string | undefined;
for (;;) {
  const players = await prisma.player.findMany({
    take: 100,
    orderBy: { id: "asc" },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  if (!players.length) break;
  for (const player of players)
    if (!(player.state as Record<string, unknown>).chronicle) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Player" WHERE id=${player.id}::uuid FOR UPDATE`;
        const fresh = await tx.player.findUniqueOrThrow({
          where: { id: player.id },
        });
        if ((fresh.state as Record<string, unknown>).chronicle) return;
        const s = stateSchema.parse(fresh.state);
        initializeChronicle(s);
        s.chronicle.startedAt = player.createdAt.getTime();
        s.chronicle.cycleStartedAt = player.createdAt.getTime();
        await tx.player.update({
          where: { id: player.id },
          data: { state: s },
        });
      });
    }
  cursor = players.at(-1)!.id;
}
await prisma.player.upsert({
  where: { id },
  update: {},
  create: { id, name: "Orren of the Quay", state: initialState(Date.now()) },
});
await prisma.world.upsert({
  where: { id: "leviathan" },
  update: {},
  create: {
    id: "leviathan",
    hp: balance.worldBossHealth,
    cycle: 0,
    resetsAt: new Date(Date.now() + 86400000),
  },
});
console.log(
  `Seed ready; sparring operator ${id}. No password account created. ${randomUUID().slice(0, 8)}`,
);
await closeDatabase();
