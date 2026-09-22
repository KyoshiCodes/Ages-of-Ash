/** Compare complete disposable restore fixtures without logging player, telemetry, or secret-bearing rows. */
import { isDeepStrictEqual } from "node:util";
import type { Client } from "pg";

const queries = {
  schema:
    "SELECT schemaname,tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename",
  migrations:
    'SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name',
  content: 'SELECT key,kind,definition FROM "ContentDefinition" ORDER BY key',
  players: 'SELECT id,state FROM "Player" ORDER BY id',
  playSessions: 'SELECT * FROM "PlaySession" ORDER BY id',
  telemetry: 'SELECT * FROM "TelemetryEvent" ORDER BY id',
  operational: 'SELECT * FROM "OperationalStatus" ORDER BY name',
} as const;

export async function restoreSnapshot(client: Client) {
  const snapshot: Record<string, unknown[]> = {};
  for (const [name, sql] of Object.entries(queries))
    snapshot[name] = (await client.query(sql)).rows;
  return snapshot;
}

export function assertRestoreParity(
  source: Awaited<ReturnType<typeof restoreSnapshot>>,
  restored: Awaited<ReturnType<typeof restoreSnapshot>>,
) {
  if (!isDeepStrictEqual(source, restored))
    throw new Error("Restore snapshot mismatch; inspect disposable databases");
}

export function assertPopulatedRestoreRejected(result: {
  status: number | null;
  error?: Error;
  stderr: string | Buffer | null;
}) {
  if (
    result.error ||
    result.status === 0 ||
    !String(result.stderr).includes("Restore target is not empty")
  )
    throw new Error("Populated-target restore was not rejected by the guard");
}
