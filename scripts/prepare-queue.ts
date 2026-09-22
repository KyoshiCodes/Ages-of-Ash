/** Explicit release-time pg-boss setup. Runtime production workers never migrate their queue schema. */
import "dotenv/config";
import { PgBoss } from "pg-boss";
if (!process.argv.includes("--approved"))
  throw new Error(
    "Queue schema preparation requires --approved and the worker-scoped DATABASE_URL",
  );
const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  createSchema: process.env.NODE_ENV !== "production",
});
boss.on("error", () =>
  console.error("Queue preparation failed (details suppressed)"),
);
try {
  await boss.start();
  for (const name of ["clocks-income-leaderboard", "event-session-timers"])
    await boss.createQueue(name, {
      retryLimit: 3,
      retryDelay: 15,
      retryBackoff: true,
    });
} finally {
  await boss.stop({ graceful: true, timeout: 45000 });
}
