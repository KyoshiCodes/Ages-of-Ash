/** Readiness exposes only aggregate booleans; details remain operator-only. */
import { isDeepStrictEqual } from "node:util";
import { prisma, pool } from "../../../packages/database/src/index.ts";
import { canonicalCatalog } from "../../../packages/gamedata/src/catalog.ts";
export async function readiness(includeWorker = true) {
  try {
    await pool.query("SELECT 1");
    const migration = await pool.query(
      'SELECT 1 FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL',
      ["20260922000000_release_foundation"],
    );
    const rows = await prisma.contentDefinition.findMany();
    const content = canonicalCatalog().every((c) =>
      rows.some(
        (r) => r.key === c.key && isDeepStrictEqual(r.definition, c.definition),
      ),
    );
    const boss = await prisma.world.findUnique({ where: { id: "leviathan" } });
    const worker = await prisma.operationalStatus.findUnique({
      where: { name: "clocks-income-leaderboard" },
    });
    const fresh =
      !!worker?.lastSuccessAt &&
      Date.now() - worker.lastSuccessAt.getTime() < 180000 &&
      (!worker.lastFailureAt || worker.lastFailureAt <= worker.lastSuccessAt);
    return {
      ok:
        !!migration.rowCount && content && !!boss && (!includeWorker || fresh),
      database: true,
      content: content && !!boss,
      worker: fresh,
    };
  } catch {
    return { ok: false, database: false, content: false, worker: false };
  }
}
