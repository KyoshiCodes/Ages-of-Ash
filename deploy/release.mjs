/** Immutable build then atomic symlink swap. Additive migrations must support the prior release. */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  symlinkSync,
  renameSync,
  readlinkSync,
  rmSync,
} from "node:fs";
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
process.umask(0o022); // Runtime users must be able to read immutable release files.
const approved = process.argv.includes("--approve-migrations");
const commit = process.argv.find((x) => x.startsWith("--commit="))?.slice(9);
if (!commit || !/^[0-9a-f]{40}$/.test(commit))
  throw new Error(
    "Specify an exact CI-verified --commit=<40-character SHA>. Without --approve-migrations this only prepares the release.",
  );
if (process.getuid?.() !== 0) throw new Error("Run with sudo");
const root = "/srv/ages",
  source = `${root}/source`,
  stamp = new Date().toISOString().replaceAll(/[:.]/g, "-"),
  release = `${root}/releases/${stamp}`;
if (!existsSync(source))
  run("runuser", [
    "-u",
    "ages-release",
    "--",
    "git",
    "clone",
    "https://github.com/KyoshiCodes/Ages-of-Ash.git",
    source,
  ]);
run("runuser", [
  "-u",
  "ages-release",
  "--",
  "git",
  "-C",
  source,
  "fetch",
  "origin",
  "main",
]);
run("runuser", [
  "-u",
  "ages-release",
  "--",
  "git",
  "-C",
  source,
  "merge-base",
  "--is-ancestor",
  commit,
  "origin/main",
]);
mkdirSync(release);
run("chown", ["ages-release:ages-release", release]);
run("runuser", [
  "-u",
  "ages-release",
  "--",
  "git",
  "-C",
  source,
  "worktree",
  "add",
  "--detach",
  release,
  commit,
]);
const { readFileSync } = await import("node:fs");
const readEnv = (path) =>
  Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
const env = readEnv("/etc/ages/api.env");
const workerEnv = readEnv("/etc/ages/worker.env");
const migrationEnv = approved ? readEnv("/etc/ages/migrate.env") : {};
if (
  approved &&
  (!migrationEnv.DATABASE_URL || migrationEnv.DATABASE_URL === env.DATABASE_URL)
)
  throw new Error("Migration and runtime DB identities must be distinct");
for (const args of [
  ["install", "--frozen-lockfile", "--prod=false"],
  ["db:generate"],
  ["verify:fast"],
])
  execFileSync("runuser", ["-u", "ages-release", "--", "pnpm", ...args], {
    cwd: release,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
if (!approved) {
  console.log(
    "Prepared " +
      release +
      ". No database changes. Review migration SQL and backup evidence, then rerun this exact commit with --approve-migrations.",
  );
  process.exit(0);
}
execFileSync("runuser", ["-u", "ages-release", "--", "pnpm", "db:deploy"], {
  cwd: release,
  stdio: "inherit",
  env: { ...process.env, ...migrationEnv },
});
execFileSync(
  "runuser",
  [
    "-u",
    "ages-release",
    "--",
    "pnpm",
    "exec",
    "tsx",
    "scripts/apply-runtime-grants.ts",
    "--approved",
  ],
  { cwd: release, stdio: "inherit", env: { ...process.env, ...migrationEnv } },
);
const previous = existsSync(`${root}/current`)
  ? readlinkSync(`${root}/current`)
  : undefined;
// A brief maintenance window prevents an older aggregate parser overwriting newly seeded fields.
if (previous) run("systemctl", ["stop", "ages-api", "ages-worker"]);
try {
  execFileSync("runuser", ["-u", "ages-release", "--", "pnpm", "db:seed"], {
    cwd: release,
    stdio: "inherit",
    env: { ...process.env, ...migrationEnv },
  });
  execFileSync(
    "runuser",
    ["-u", "ages-release", "--", "pnpm", "queue:prepare", "--approved"],
    { cwd: release, stdio: "inherit", env: { ...process.env, ...workerEnv } },
  );
} catch (error) {
  if (previous) run("systemctl", ["start", "ages-api", "ages-worker"]);
  throw error;
}
if (existsSync(`${root}/next`)) rmSync(`${root}/next`);
symlinkSync(release, `${root}/next`);
renameSync(`${root}/next`, `${root}/current`);
run("systemctl", ["enable", "ages-api", "ages-worker", "ages-backup.timer"]);
run("systemctl", ["restart", "ages-api", "ages-worker"]);
let healthy = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/ready");
    if (res.ok) {
      healthy = true;
      break;
    }
  } catch {
    /* process warming */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!healthy) {
  if (previous && process.argv.includes("--allow-code-rollback")) {
    symlinkSync(previous, `${root}/rollback`);
    renameSync(`${root}/rollback`, `${root}/current`);
    run("systemctl", ["restart", "ages-api", "ages-worker"]);
  }
  throw new Error(
    "Readiness failed. Code rollback requires --allow-code-rollback and backward-compatible migrations. Schema/data were not rolled back.",
  );
}
run("caddy", ["validate", "--config", "/etc/caddy/Caddyfile"]);
run("systemctl", ["enable", "--now", "caddy", "ages-backup.timer"]);
run("systemctl", ["reload", "caddy"]);
console.log(`Live release: ${release}`);
