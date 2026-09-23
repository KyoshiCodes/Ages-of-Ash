/** Gated Ubuntu host preparation; only staging-approved operators may run it, with separate Unix identities. */
import { execFileSync } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
const run = (command, args) =>
  execFileSync(command, args, { stdio: "inherit", shell: false });
if (process.platform !== "linux" || process.getuid?.() !== 0)
  throw new Error("Run as root on an approved Ubuntu 24.04 staging host");
const osRelease = readFileSync("/etc/os-release", "utf8");
if (
  !/^ID=ubuntu$/m.test(osRelease) ||
  !/^VERSION_ID="?24\.04"?$/m.test(osRelease)
)
  throw new Error("Host provisioning supports Ubuntu 24.04 only");
const domain = process.argv[2];
if (
  !domain ||
  !/^staging\.[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ||
  !process.argv.includes("--approve-host-provisioning")
)
  throw new Error(
    "Usage: sudo node deploy/provision.mjs staging.example.com --approve-host-provisioning (requires separate reviewed OCI/network approval)",
  );
console.log(
  "Approved host provisioning target: " +
    domain +
    "; inspect this script and the staging plan before continuing",
);
const architecture =
  process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : "";
if (!architecture)
  throw new Error("Only reviewed ARM64 or x86_64 hosts are supported");
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
  if (!response.ok) throw new Error("Package key download failed: " + name);
  writeFileSync("/etc/apt/keyrings/" + name + ".asc", await response.text());
}
writeFileSync(
  "/etc/apt/sources.list.d/ages-node.list",
  "deb [arch=" +
    architecture +
    " signed-by=/etc/apt/keyrings/nodesource.asc] https://deb.nodesource.com/node_24.x nodistro main\n",
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
for (const user of ["ages-release", "ages-api", "ages-worker", "ages-backup"]) {
  try {
    execFileSync("id", [user], { stdio: "ignore", shell: false });
  } catch {
    run("useradd", [
      "--system",
      "--user-group",
      "--create-home",
      "--home-dir",
      "/var/lib/" + user,
      "--shell",
      "/usr/sbin/nologin",
      user,
    ]);
  }
}
for (const directory of [
  "/srv/ages",
  "/srv/ages/releases",
  "/var/backups/ages",
  "/etc/ages",
])
  mkdirSync(directory, { recursive: true });
run("chown", ["ages-release:ages-release", "/srv/ages", "/srv/ages/releases"]);
run("chmod", ["0755", "/srv/ages", "/srv/ages/releases"]);
run("chown", ["ages-backup:ages-backup", "/var/backups/ages"]);
run("chmod", ["0700", "/var/backups/ages"]);
run("chown", ["root:root", "/etc/ages"]);
run("chmod", ["0755", "/etc/ages"]);
for (const unit of [
  "ages-api.service",
  "ages-worker.service",
  "ages-backup.service",
  "ages-backup.timer",
])
  copyFileSync(new URL(unit, import.meta.url), "/etc/systemd/system/" + unit);
let caddy = await (
  await import("node:fs/promises")
).readFile(new URL("Caddyfile", import.meta.url), "utf8");
caddy = caddy.replace("game.example.com", domain);
writeFileSync("/etc/caddy/Caddyfile", caddy);
const envFiles = [
  [
    "api.env",
    "ages-api",
    "DATABASE_URL=postgresql://ages_api:REPLACE_ME@127.0.0.1:5432/ages\nAPP_ORIGIN=https://" +
      domain +
      "\nNODE_ENV=production\nHOST=127.0.0.1\nPORT=3000\nOPS_TOKEN=REPLACE_WITH_32_RANDOM_CHARACTERS\nANALYTICS_ENABLED=false\n",
  ],
  [
    "worker.env",
    "ages-worker",
    "DATABASE_URL=postgresql://ages_worker:REPLACE_ME@127.0.0.1:5432/ages\nNODE_ENV=production\nWORKER_PORT=3001\nAPP_ORIGIN=https://" +
      domain +
      "\nHOST=127.0.0.1\nOPS_TOKEN=REPLACE_WITH_DISTINCT_32_RANDOM_CHARACTERS\n",
  ],
  [
    "backup.env",
    "ages-backup",
    "DATABASE_URL=postgresql://ages_backup:REPLACE_ME@127.0.0.1:5432/ages\nBACKUP_DIR=/var/backups/ages\nPG_BIN=/usr/lib/postgresql/18/bin\n",
  ],
  [
    "migrate.env",
    "root",
    "DATABASE_URL=postgresql://ages_migrator:REPLACE_ME@127.0.0.1:5432/ages\nNODE_ENV=production\n",
  ],
];
for (const [name, group, content] of envFiles) {
  const path = "/etc/ages/" + name;
  if (!existsSync(path))
    writeFileSync(path, content, {
      mode: name === "migrate.env" ? 0o600 : 0o640,
    });
  chmodSync(path, name === "migrate.env" ? 0o600 : 0o640);
  run("chown", ["root:" + group, path]);
}
for (const port of ["80", "443"]) {
  try {
    execFileSync(
      "iptables",
      ["-C", "INPUT", "-p", "tcp", "--dport", port, "-j", "ACCEPT"],
      { stdio: "ignore", shell: false },
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
  "Host prepared. Replace env placeholders privately; set DB grants and OCI network gates before release.",
);
