/** Consistent custom-format database dumps. No credentials in argv; retain seven local copies. */
import { execFileSync } from "node:child_process";
import { readdirSync, unlinkSync } from "node:fs";
const url = new URL(process.env.DATABASE_URL);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const args = [
  "-h",
  url.hostname,
  "-p",
  url.port || "5432",
  "-U",
  decodeURIComponent(url.username),
  "-d",
  url.pathname.slice(1),
];
const file = `/var/backups/ages/${new Date().toISOString().replaceAll(/[:.]/g, "-")}.dump`;
execFileSync("pg_dump", [...args, "-Fc", "-f", file], {
  env,
  stdio: "inherit",
});
const dumps = readdirSync("/var/backups/ages")
  .filter((name) => name.endsWith(".dump"))
  .sort()
  .reverse();
for (const name of dumps.slice(7)) unlinkSync(`/var/backups/ages/${name}`);
console.log(file);
