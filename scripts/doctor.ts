/** Windows preflight. Reports only unless --fix is supplied; never installs system software. */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { totalmem, freemem, platform } from "node:os";
import { existsSync, readFileSync } from "node:fs";
const run = (exe: string, args: string[]) => {
  try {
    return execFileSync(exe, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
};
const ps = (script: string) =>
  run("powershell.exe", ["-NoProfile", "-Command", script]);
let failures = 0;
function report(
  ok: boolean,
  label: string,
  detected: string,
  required: string,
  fix: string,
  optional = false,
) {
  if (!ok && !optional) failures++;
  console.log(
    `${ok ? "✅" : optional ? "⚠️" : "❌"} ${label}: ${detected || "not detected"}; required ${required}${ok ? "" : `\n   Fix: ${fix}`}`,
  );
}
const checks: [string, string[], string, RegExp, string, boolean?][] = [
  [
    "node",
    ["--version"],
    "24.21.0+ in 24.x",
    /^v24\.(2[1-9]|[3-9]\d|\d{3,})\./,
    "volta install node@24.21.0",
  ],
  [
    "volta",
    ["--version"],
    "latest stable",
    /\d+\.\d+/,
    "winget install -e --id Volta.Volta",
  ],
  [
    "pnpm",
    ["--version"],
    "12.5.1+ in 12.x",
    /^12\.(?:[6-9]|\d{2,})\.|^12\.5\.[1-9]\d*/,
    "volta install pnpm@12.5.1",
  ],
  [
    "git",
    ["--version"],
    "2.40+",
    /2\.(?:[4-9]\d|\d{3,})\./,
    "winget install -e --id Git.Git",
  ],
  [
    "psql",
    ["--version"],
    "18.6+",
    /18\.(?:[6-9]|\d{2,})/,
    'winget install -e --id PostgreSQL.PostgreSQL.18; $env:Path += ";C:\\Program Files\\PostgreSQL\\18\\bin"',
  ],
  [
    "gh",
    ["--version"],
    "latest stable (optional)",
    /gh version/,
    "winget install -e --id GitHub.cli",
    true,
  ],
  [
    "code",
    ["--version"],
    "VS Code (optional)",
    /\d+\.\d+/,
    "winget install -e --id Microsoft.VisualStudioCode",
    true,
  ],
];
console.log(
  "Ages of Ash environment doctor — no system installs are performed.",
);
report(
  platform() === "win32",
  "OS",
  platform() === "win32"
    ? ps("(Get-CimInstance Win32_OperatingSystem).Version")
    : platform(),
  "Windows 10 build 19045+ or Windows 11",
  "Run Windows Update",
  platform() !== "win32",
);
for (const [exe, args, required, regex, fix, optional] of checks) {
  const output =
    platform() === "win32" && ["pnpm", "code"].includes(exe)
      ? ps(`& ${exe} ${args.join(" ")}`)
      : run(exe, args);
  report(
    regex.test(output),
    exe,
    output.split("\n")[0] ?? "",
    required,
    fix,
    optional,
  );
}
report(
  totalmem() >= 15 * 1024 ** 3,
  "RAM",
  `${(totalmem() / 1024 ** 3).toFixed(1)} GB; ${(freemem() / 1024 ** 3).toFixed(1)} GB free`,
  "16 GB installed; 4 GB free recommended",
  "Close memory-heavy applications",
  true,
);
if (platform() === "win32") {
  const build = Number(
    ps("(Get-CimInstance Win32_OperatingSystem).BuildNumber"),
  );
  report(
    build >= 19045,
    "Windows build",
    String(build),
    "19045+",
    "Run Windows Update",
  );
  const free =
    Number(ps("(Get-PSDrive -Name (Get-Location).Drive.Name).Free")) /
    1024 ** 3;
  report(
    free >= 10,
    "Disk",
    `${free.toFixed(1)} GB free`,
    "10 GB",
    "Free disk space before installing dependencies",
  );
  const services = ps(
    "Get-Service *postgres* | Select-Object Name,Status | Out-String",
  );
  report(
    /Running/.test(services),
    "PostgreSQL service",
    services,
    "running PostgreSQL 18",
    "Get-Service *postgres* | Start-Service # Administrator PowerShell",
  );
  console.log(
    `Volta/PATH order:\n${ps("Get-Command node,pnpm,volta -All | Select-Object Name,Source | Out-String")}\nExpected Volta shims before other Node installations.`,
  );
  for (const port of [5173, 3000, 5432]) {
    const owner = ps(
      `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess } | Select-Object -Unique ProcessName,Id | Out-String`,
    );
    report(
      !owner || (port === 5432 && /postgres/.test(owner)),
      `Port ${port}`,
      owner || "available",
      port === 5432 ? "PostgreSQL 18 or free" : "free before pnpm dev",
      `Get-NetTCPConnection -LocalPort ${port} | Select-Object OwningProcess # stop only a process you own`,
      true,
    );
  }
}
for (const [name, min] of [
  ["typescript", "5.9"],
  ["@playwright/test", "1.63"],
] as const) {
  const path = `node_modules/${name}/package.json`;
  const version = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as { version: string }).version
    : "";
  const parts = version.split(".").map(Number),
    wanted = min.split(".").map(Number);
  report(
    parts[0] > wanted[0] || (parts[0] === wanted[0] && parts[1] >= wanted[1]),
    name,
    version,
    `${min}+`,
    "pnpm install",
  );
}
try {
  const response = await fetch("https://registry.npmjs.org/pnpm/latest", {
    signal: AbortSignal.timeout(5000),
  });
  const registry = (await response.json()) as { version: string };
  console.log(
    `✅ Registry reference: latest pnpm ${registry.version}; project pin 12.5.1. Upgrade only within the required major after verification.`,
  );
} catch {
  console.log(
    "⚠️ Registry unreachable; using checked-in version requirements.",
  );
}
report(
  existsSync(".env"),
  "Configuration",
  existsSync(".env") ? ".env exists" : "",
  ".env with app database credentials",
  "Copy-Item .env.example .env",
);
try {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  await client.connect();
  const result = await client.query(
    "SELECT version(), current_user, current_database(), inet_server_port() AS port",
  );
  console.log(
    "✅ Database, role, authentication and port probe:",
    result.rows[0],
  );
  const versionResult = await client.query("SHOW server_version_num");
  const serverVersion = Number(versionResult.rows[0].server_version_num);
  report(
    serverVersion >= 180006 && serverVersion < 190000,
    "Connected PostgreSQL server",
    String(serverVersion),
    "18.6+ within 18.x",
    "Upgrade PostgreSQL 18 using the EDB installer and check DATABASE_URL points to that service",
  );
  try {
    console.log(
      "Auth rules:",
      (
        await client.query(
          "SELECT type, auth_method FROM pg_hba_file_rules WHERE error IS NULL",
        )
      ).rows,
    );
  } catch {
    if (process.env.PG_ADMIN_URL) {
      const admin = new Client({
        connectionString: process.env.PG_ADMIN_URL,
        connectionTimeoutMillis: 3000,
      });
      try {
        await admin.connect();
        const rules = await admin.query(
          "SELECT type, auth_method FROM pg_hba_file_rules WHERE error IS NULL AND type LIKE 'host%'",
        );
        report(
          rules.rows.length > 0 &&
            rules.rows.every(
              (r: { auth_method: string }) => r.auth_method === "scram-sha-256",
            ),
          "TCP authentication",
          JSON.stringify(rules.rows),
          "scram-sha-256",
          "Edit pg_hba.conf TCP rules to scram-sha-256 and reload PostgreSQL",
        );
      } finally {
        await admin.end();
      }
    } else
      console.log(
        "⚠️ Auth mode: app role cannot inspect pg_hba_file_rules. Supply PG_ADMIN_URL for inspection, or as postgres run: SELECT type, auth_method FROM pg_hba_file_rules; require scram-sha-256 for TCP.",
      );
  }
  await client.end();
} catch (error) {
  report(
    false,
    "App database probe",
    error instanceof Error ? error.message : "failed",
    "app role + database + successful TCP auth",
    "Set PG_ADMIN_URL in .env, then pnpm setup:db",
  );
}
if (process.argv.includes("--fix")) {
  const { execute } = await import("./process.ts");
  execute("volta", ["pin", "node@24.21.0"]);
  execute("volta", ["install", "pnpm@12.5.1"]);
  execute("pnpm", ["install"]);
  execute("pnpm", ["setup:db"]);
  console.log(
    "Safe fixes completed. Run pnpm run doctor again. Browser binary: pnpm exec playwright install chromium",
  );
} else {
  console.log(
    "Remediation: apply printed system fixes yourself; pnpm run doctor --fix pins tools, installs packages, creates app database when authorized by PG_ADMIN_URL, generates, migrates and seeds.",
  );
  process.exitCode = failures ? 1 : 0;
}
