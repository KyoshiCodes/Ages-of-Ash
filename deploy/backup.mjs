/** Atomic custom-format backup; a failed dump never displaces a valid backup. */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  renameSync,
  readdirSync,
  unlinkSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
const url = new URL(process.env.DATABASE_URL),
  directory = resolve(process.env.BACKUP_DIR ?? "/var/backups/ages");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const file = join(
    directory,
    new Date().toISOString().replaceAll(/[:.]/g, "-") + ".dump",
  ),
  temporary = file + ".partial";
const binary = process.env.PG_BIN
  ? process.env.PG_BIN +
    "/pg_dump" +
    (process.platform === "win32" ? ".exe" : "")
  : "pg_dump";
execFileSync(
  binary,
  [
    "-h",
    url.hostname,
    "-p",
    url.port || "5432",
    "-U",
    decodeURIComponent(url.username),
    "-d",
    url.pathname.slice(1),
    "-Fc",
    "-f",
    temporary,
  ],
  {
    shell: false,
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    stdio: "inherit",
  },
);
chmodSync(temporary, 0o600);
renameSync(temporary, file);
const dumps = readdirSync(directory)
  .filter((name) => /^\d{4}-.*\.dump$/.test(name))
  .sort()
  .reverse();
for (const name of dumps.slice(7)) unlinkSync(join(directory, name));
console.log(
  "Backup completed; verify and copy encrypted backups off-host according to the runbook.",
);
