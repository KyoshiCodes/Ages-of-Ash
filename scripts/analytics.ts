/** Operator-only retention report. Rolling cohorts exclude players who have not aged into a return window. */
import { prisma, closeDatabase } from "../packages/database/src/index.ts";
if (
  process.env.ANALYTICS_ENABLED !== "true" ||
  !process.argv.includes("--operator")
) {
  await closeDatabase();
  throw new Error(
    "Operator-only: explicitly enable analytics and pass --operator; see runbook",
  );
}
const retention =
  await prisma.$queryRaw`SELECT d AS day, count(*)::int AS eligible, count(*) FILTER(WHERE EXISTS(SELECT 1 FROM "PlaySession" s WHERE s."playerId"=p.id AND s."startedAt">=p."createdAt"+d*interval '1 day' AND s."startedAt"<p."createdAt"+(d+1)*interval '1 day'))::int AS returned FROM "Player" p CROSS JOIN (VALUES(1),(7)) days(d) WHERE p."createdAt"<=now()-(d+1)*interval '1 day' AND p.id<>'00000000-0000-4000-8000-000000000001'::uuid GROUP BY d ORDER BY d`;
const sessions =
  await prisma.$queryRaw`SELECT count(*)::int AS sessions,round(avg(extract(epoch FROM ("lastAt"-"startedAt"))))::int AS average_seconds,round(avg(operations),2)::float8 AS operations_per_session FROM "PlaySession"`;
const prestige =
  await prisma.$queryRaw`SELECT count(*)::int AS players,percentile_cont(.5) WITHIN GROUP(ORDER BY value)::float8 AS median_seconds_to_first_prestige FROM (SELECT DISTINCT ON("playerId") value FROM "TelemetryEvent" WHERE type='ash-cycle' ORDER BY "playerId",at) first_cycles`;
const dropoff =
  await prisma.$queryRaw`SELECT "lastStep",count(*)::int AS sessions FROM "PlaySession" WHERE "lastAt"<now()-interval '30 minutes' GROUP BY "lastStep" ORDER BY sessions DESC`;
console.log(
  JSON.stringify({ retention, sessions, prestige, dropoff }, null, 2),
);
await closeDatabase();
