/** Operator-only retention cleanup. Dry-run is the default; never deletes audit or reward receipts. */
import { prisma, closeDatabase } from "../packages/database/src/index.ts";
const cutoff = new Date(Date.now() - 30 * 86400000);
try {
  const count = await prisma.playSession.count({
    where: { lastAt: { lt: cutoff } },
  });
  console.log(
    JSON.stringify({
      eligibleSessions: count,
      retentionDays: 30,
      mode: process.argv.includes("--confirm-delete")
        ? "explicit deletion"
        : "dry run",
    }),
  );
  if (process.argv.includes("--confirm-delete"))
    await prisma.playSession.deleteMany({ where: { lastAt: { lt: cutoff } } });
} finally {
  await closeDatabase();
}
