/** Ubuntu 24.04 ARM64 provisioner. Run as root; never opens the database to the internet. */
import { execFileSync } from "node:child_process";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
if (process.platform !== "linux" || process.getuid() !== 0)
  throw new Error("Run with sudo on Ubuntu 24.04");
const domain = process.argv[2];
if (!domain || !/^[a-z0-9.-]+$/.test(domain))
  throw new Error("Usage: sudo node deploy/provision.mjs game.example.com");
run("apt-get", ["update"]);
run("apt-get", [
  "install",
  "-y",
  "ca-certificates",
  "gnupg",
  "git",
  "postgresql-common",
  "caddy",
  "iptables-persistent",
]);
mkdirSync("/etc/apt/keyrings", { recursive: true });
for (const [name, url] of [
  ["nodesource", "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key"],
  ["postgresql", "https://www.postgresql.org/media/keys/ACCC4CF8.asc"],
]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Key download failed: ${name}`);
  writeFileSync(`/etc/apt/keyrings/${name}.asc`, await response.text());
}
writeFileSync(
  "/etc/apt/sources.list.d/ages-node.list",
  "deb [arch=arm64 signed-by=/etc/apt/keyrings/nodesource.asc] https://deb.nodesource.com/node_24.x nodistro main\n",
);
writeFileSync(
  "/etc/apt/sources.list.d/ages-postgresql.list",
  "deb [signed-by=/etc/apt/keyrings/postgresql.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main\n",
);
run("apt-get", ["update"]);
run("apt-get", [
  "install",
  "-y",
  "nodejs",
  "postgresql-18",
  "postgresql-client-18",
]);
run("npm", ["install", "--global", "pnpm@12.5.1"]);
try {
  execFileSync("id", ["ages"], { stdio: "ignore" });
} catch {
  run("useradd", [
    "--system",
    "--create-home",
    "--home-dir",
    "/srv/ages",
    "--shell",
    "/usr/sbin/nologin",
    "ages",
  ]);
}
for (const dir of [
  "/srv/ages",
  "/srv/ages/releases",
  "/var/backups/ages",
  "/etc/ages",
])
  mkdirSync(dir, { recursive: true });
run("chown", ["-R", "ages:ages", "/srv/ages", "/var/backups/ages"]);
for (const unit of [
  "ages-api.service",
  "ages-worker.service",
  "ages-backup.service",
  "ages-backup.timer",
])
  copyFileSync(new URL(unit, import.meta.url), `/etc/systemd/system/${unit}`);
let caddy = await (
  await import("node:fs/promises")
).readFile(new URL("Caddyfile", import.meta.url), "utf8");
caddy = caddy.replace("game.example.com", domain);
writeFileSync("/etc/caddy/Caddyfile", caddy);
if (!existsSync("/etc/ages/ages.env")) {
  writeFileSync(
    "/etc/ages/ages.env",
    `DATABASE_URL=postgresql://ages:REPLACE_ME@127.0.0.1:5432/ages\nAPP_ORIGIN=https://${domain}\nNODE_ENV=production\nHOST=127.0.0.1\nPORT=3000\n`,
  );
  chmodSync("/etc/ages/ages.env", 0o640);
  run("chown", ["root:ages", "/etc/ages/ages.env"]);
}
for (const port of ["80", "443"]) {
  try {
    execFileSync(
      "iptables",
      ["-C", "INPUT", "-p", "tcp", "--dport", port, "-j", "ACCEPT"],
      { stdio: "ignore" },
    );
  } catch {
    run("iptables", [
      "-I",
      "INPUT",
      "1",
      "-p",
      "tcp",
      "--dport",
      port,
      "-j",
      "ACCEPT",
    ]);
  }
}
run("netfilter-persistent", ["save"]);
run("systemctl", ["daemon-reload"]);
run("systemctl", ["enable", "--now", "postgresql"]);
console.log(
  "Provisioned. Configure role/database and /etc/ages/ages.env, then deploy. Also open TCP 80/443 in the OCI VCN security list.",
);
