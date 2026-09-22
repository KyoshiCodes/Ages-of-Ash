/** Scheduled catch-up worker. Elapsed timestamps make duplicate runs and sleeping laptops safe. */
import { prisma, closeDatabase } from "../../../packages/database/src/index.ts";
import {
  PostgresQueue,
  observedJob,
} from "../../../packages/infrastructure/src/index.ts";
import {
  stateSchema,
  tick,
  power,
} from "../../../packages/engine/src/index.ts";
import { balance } from "../../../packages/gamedata/src/index.ts";
import { notify, lockPlayers } from "../../api/src/service.ts";
import { createServer } from "node:http";
import {
  runtimeConfig,
  operationLog,
  errorKind,
  healthStats,
} from "../../../packages/infrastructure/src/operations.ts";
import { readiness } from "../../api/src/readiness.ts";
const config = runtimeConfig(process.env);
let draining = false;
const queue = new PostgresQueue();
await queue.start();
async function clocks() {
  let cursor: string | undefined;
  for (;;) {
    const players = await prisma.player.findMany({
      take: 100,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
    if (!players.length) break;
    for (const p of players) {
      if (draining) throw new Error("Worker draining; catch-up retries safely");
      await prisma.$transaction(async (tx) => {
        await lockPlayers(tx, [p.id]);
        const player = await tx.player.findUniqueOrThrow({
          where: { id: p.id },
        });
        const s = tick(stateSchema.parse(player.state), Date.now());
        await tx.player.update({ where: { id: p.id }, data: { state: s } });
        await tx.leaderboard.upsert({
          where: { playerId: p.id },
          create: {
            playerId: p.id,
            name: player.name,
            score: Math.floor(power(s) + s.level * 100),
            level: s.level,
            influence: s.influence.reduce((a, b) => a + b, 0),
          },
          update: {
            name: player.name,
            score: Math.floor(power(s) + s.level * 100),
            level: s.level,
            influence: s.influence.reduce((a, b) => a + b, 0),
          },
        });
        await notify(tx, p.id);
      });
    }
    cursor = players.at(-1)!.id;
  }
}
async function timers() {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "World" WHERE id='leviathan' FOR UPDATE`;
    const world = await tx.world.findUnique({ where: { id: "leviathan" } });
    if (world && world.hp === 0 && world.resetsAt.getTime() <= Date.now())
      await tx.world.update({
        where: { id: world.id },
        data: {
          hp: balance.worldBossHealth,
          cycle: { increment: 1 },
          resetsAt: new Date(Date.now() + 86400000),
        },
      });
    await notify(tx);
  });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
await queue.schedule("clocks-income-leaderboard", "* * * * *", clocks);
await queue.schedule("event-session-timers", "*/5 * * * *", timers);

const server = createServer(async (req, res) => {
  const status = await readiness();
  res.setHeader("content-type", "application/json");
  if (req.url === "/ready") {
    res.statusCode = !draining && status.ok ? 200 : 503;
    res.end(JSON.stringify({ ok: !draining && status.ok }));
  } else if (req.url === "/metrics") {
    res.end(JSON.stringify({ ...healthStats, draining, readiness: status }));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise<void>((r, j) => {
  server.once("error", j);
  server.listen(config.WORKER_PORT, "127.0.0.1", r);
});
async function shutdown() {
  if (draining) return;
  draining = true;
  operationLog("worker_draining");
  const deadline = setTimeout(() => process.exit(1), 55000);
  deadline.unref();
  try {
    await new Promise<void>((r) => server.close(() => r()));
    await queue.stop();
    await closeDatabase();
    operationLog("worker_stopped");
  } catch (error) {
    operationLog("worker_shutdown_failed", { code: errorKind(error) });
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void shutdown());
await observedJob("clocks-income-leaderboard", clocks);
await observedJob("event-session-timers", timers);
console.log("Ages worker ready");
