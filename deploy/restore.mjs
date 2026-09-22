/** Guarded restore: verifies an empty non-production target, uses one transaction and no credentials in argv. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "pg";
const file = process.argv[2],
  url = new URL(process.env.DATABASE_URL);
if (
  !file ||
  !existsSync(file) ||
  !process.argv.includes("--confirm-empty-target") ||
  !/^ages_restore_[a-z0-9_]+$/.test(url.pathname.slice(1)) ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "Restore requires a new ages_restore_* database, non-production environment and --confirm-empty-target",
  );
const client = new Client({ connectionString: url.toString() });
try {
  await client.connect();
  const occupied = await client.query(
    "SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') LIMIT 1",
  );
  if (occupied.rowCount) throw new Error("Restore target is not empty");
} finally {
  await client.end();
}
const binary = process.env.PG_BIN
  ? process.env.PG_BIN +
    "/pg_restore" +
    (process.platform === "win32" ? ".exe" : "")
  : "pg_restore";
execFileSync(
  binary,
  [
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-acl",
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    url.pathname.slice(1),
    file,
  ],
  {
    shell: false,
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    stdio: "inherit",
  },
);
console.log(
  "Restore completed into the explicitly named non-production target.",
);
