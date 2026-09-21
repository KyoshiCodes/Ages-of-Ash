/** Explicit restore into an already-created empty database. Refuses implicit overwrite. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
const file = process.argv[2];
if (!file || !existsSync(file) || process.argv[3] !== "--confirm-empty-target")
  throw new Error(
    "Usage: node deploy/restore.mjs backup.dump --confirm-empty-target; set DATABASE_URL to a new empty database first",
  );
const url = new URL(process.env.DATABASE_URL);
execFileSync(
  "pg_restore",
  [
    "--exit-on-error",
    "--no-owner",
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
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    stdio: "inherit",
  },
);
