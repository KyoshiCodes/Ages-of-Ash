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
if (process.getuid?.() !== 0) throw new Error("Run with sudo");
const root = "/srv/ages",
  source = `${root}/source`,
  stamp = new Date().toISOString().replaceAll(/[:.]/g, "-"),
  release = `${root}/releases/${stamp}`;
if (!existsSync(source))
  run("runuser", [
    "-u",
    "ages",
    "--",
    "git",
    "clone",
    "https://github.com/KyoshiCodes/Ages-of-Ash.git",
    source,
  ]);
run("runuser", [
  "-u",
  "ages",
  "--",
  "git",
  "-C",
  source,
  "fetch",
  "origin",
  "main",
]);
mkdirSync(release);
run("chown", ["ages:ages", release]);
run("runuser", [
  "-u",
  "ages",
  "--",
  "git",
  "-C",
  source,
  "worktree",
  "add",
  "--detach",
  release,
  "origin/main",
]);
const { readFileSync } = await import("node:fs");
const env = Object.fromEntries(
  readFileSync("/etc/ages/ages.env", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
for (const args of [
  ["install", "--frozen-lockfile"],
  ["db:generate"],
  ["verify"],
  ["db:deploy"],
])
  execFileSync("runuser", ["-u", "ages", "--", "pnpm", ...args], {
    cwd: release,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
const previous = existsSync(`${root}/current`)
  ? readlinkSync(`${root}/current`)
  : undefined;
// A brief maintenance window prevents an older aggregate parser overwriting newly seeded fields.
if (previous) run("systemctl", ["stop", "ages-api", "ages-worker"]);
try {
  execFileSync("runuser", ["-u", "ages", "--", "pnpm", "db:seed"], {
    cwd: release,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
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
    const res = await fetch("http://127.0.0.1:3000/api/health");
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
  if (previous) {
    symlinkSync(previous, `${root}/rollback`);
    renameSync(`${root}/rollback`, `${root}/current`);
    run("systemctl", ["restart", "ages-api", "ages-worker"]);
  }
  throw new Error(
    "Health check failed; previous code restored when available. Schema was not rolled back.",
  );
}
run("caddy", ["validate", "--config", "/etc/caddy/Caddyfile"]);
run("systemctl", ["enable", "--now", "caddy", "ages-backup.timer"]);
run("systemctl", ["reload", "caddy"]);
console.log(`Live release: ${release}`);
