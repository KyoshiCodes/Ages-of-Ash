/** Disposable-database acceptance runner. Never reads DATABASE_URL or migrates an existing application database. */
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { resolve, join, sep } from "node:path";
import { commandSpec, execute } from "./process.ts";
import { databaseStatus, clientStatus } from "./database-status.ts";
const suffix = randomBytes(8).toString("hex"),
  database = `ages_verify_${suffix}`,
  role = `ages_verify_${suffix}`,
  backupRole = `ages_backup_${suffix}`;
const logs = resolve("artifacts/release", suffix);
mkdirSync(logs, { recursive: true });
const root = resolve(".local");
mkdirSync(root, { recursive: true });
let nativeDir: string | undefined,
  bin: string | undefined,
  started = false,
  created = false,
  roleCreated = false,
  backupRoleCreated = false,
  restored = false;
let admin: Client | undefined;
async function freePort() {
  const server = createServer();
  await new Promise<void>((r, j) => {
    server.once("error", j);
    server.listen(0, "127.0.0.1", r);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
async function step(label: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`=== ${label} ===`);
  const spec = commandSpec("pnpm", args);
  let output = "";
  const child = spawn(spec.command, spec.args, {
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (chunk: Buffer) => {
    const safe = chunk
      .toString()
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE REDACTED]");
    output += safe;
    process.stdout.write(safe);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const code = await new Promise<number | null>((r, j) => {
    child.once("error", j);
    child.once("close", r);
  });
  writeFileSync(join(logs, label + ".log"), output);
  if (code !== 0) throw new Error(`${label} failed; see artifact log`);
}
try {
  let adminUrl = process.env.VERIFY_ADMIN_URL;
  if (!adminUrl) {
    if (process.platform !== "win32")
      throw new Error(
        "Set VERIFY_ADMIN_URL explicitly to a disposable-server bootstrap account",
      );
    bin = [
      process.env.PG_BIN,
      "C:/Program Files/PostgreSQL/18/bin",
      ".local/postgresql/pgsql/bin",
    ].find((p) => p && existsSync(join(p, "initdb.exe")));
    if (!bin)
      throw new Error(
        "Set PG_BIN to native PostgreSQL 18 binaries, or explicitly set VERIFY_ADMIN_URL",
      );
    bin = resolve(bin);
    nativeDir = mkdtempSync(join(root, "release-"));
    const password = randomBytes(24).toString("hex"),
      pw = join(nativeDir, "password");
    writeFileSync(pw, password, { mode: 0o600 });
    const data = join(nativeDir, "data"),
      port = await freePort();
    execute(join(bin, "initdb.exe"), [
      "-D",
      data,
      "-U",
      "postgres",
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
      `--pwfile=${pw}`,
    ]);
    execute(join(bin, "pg_ctl.exe"), [
      "start",
      "-D",
      data,
      "-l",
      join(nativeDir, "postgres.log"),
      "-o",
      `-p ${port} -h 127.0.0.1`,
      "-w",
    ]);
    started = true;
    adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  }
  const url = new URL(adminUrl);
  if (!["postgresql:", "postgres:"].includes(url.protocol))
    throw new Error("Invalid bootstrap URL");
  admin = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  const password = randomBytes(24).toString("hex");
  await admin.query(
    `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  roleCreated = true;
  await admin.query(`CREATE DATABASE "${database}" OWNER "${role}"`);
  created = true;
  const backupPassword = randomBytes(24).toString("hex");
  await admin.query(
    `CREATE ROLE "${backupRole}" LOGIN PASSWORD '${backupPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  backupRoleCreated = true;
  await admin.query(`GRANT pg_read_all_data TO "${backupRole}"`);
  await admin.query(
    `GRANT CONNECT ON DATABASE "${database}" TO "${backupRole}"`,
  );
  url.username = role;
  url.password = password;
  url.pathname = "/" + database;
  url.search = "";
  const backupUrl = new URL(url.toString());
  backupUrl.username = backupRole;
  backupUrl.password = backupPassword;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url.toString(),
    APP_ORIGIN: "http://localhost:5173",
    HOST: "127.0.0.1",
    PORT: "3000",
    WORKER_PORT: "3001",
    NODE_ENV: "test",
    ANALYTICS_ENABLED: "true",
    AGES_FULL_VERIFY: "true",
  };
  delete env.PG_ADMIN_URL;
  delete env.VERIFY_ADMIN_URL;
  delete env.MIGRATION_DATABASE_URL;
  const probe = new Client({ connectionString: env.DATABASE_URL });
  await probe.connect();
  try {
    const count = await probe.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
    );
    if (count.rows[0].n !== 0)
      throw new Error(
        "Fresh database unexpectedly contains application tables",
      );
    await step("00-bootstrap-probe", ["setup:db"], env);
    const afterBootstrap = await probe.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
    );
    if (afterBootstrap.rows[0].n !== 0)
      throw new Error("setup:db unexpectedly migrated or seeded the database");
    const emptyIssues = await databaseStatus(probe);
    if (
      !emptyIssues.some((x) => x.startsWith("Pending")) ||
      !emptyIssues.some((x) => x.startsWith("Missing canonical"))
    )
      throw new Error("Readiness failed to detect empty database");
    await step("01-generate", ["db:generate"], env);
    if (clientStatus()) throw new Error(clientStatus()!);
    await step("02-migrate", ["db:deploy"], env);
    await step("03-seed", ["db:seed"], env);
    const saved = await probe.query(
      'SELECT id,state FROM "Player" ORDER BY id',
    );
    await step("04-migrate-repeat", ["db:deploy"], env);
    await step("05-seed-repeat", ["db:seed"], env);
    if (
      JSON.stringify(saved.rows) !==
      JSON.stringify(
        (await probe.query('SELECT id,state FROM "Player" ORDER BY id')).rows,
      )
    )
      throw new Error("Repeated seed altered existing player progress");

    const backupPrivileges = await probe.query(
      "SELECT has_table_privilege($1, $2, $3) AS can_write",
      [backupRole, 'public."Player"', "INSERT"],
    );
    if (backupPrivileges.rows[0].can_write)
      throw new Error(
        "Read-only backup role unexpectedly has player write access",
      );

    if (bin && nativeDir) {
      const dumpDir = join(nativeDir, "backups");
      const backupEnv = {
        ...env,
        DATABASE_URL: backupUrl.toString(),
        PG_BIN: bin,
        BACKUP_DIR: dumpDir,
      };
      await step(
        "05a-backup",
        ["exec", "node", "deploy/backup.mjs"],
        backupEnv,
      );
      const { readdirSync } = await import("node:fs");
      const dump = join(
        dumpDir,
        readdirSync(dumpDir).find((name) => name.endsWith(".dump"))!,
      );
      const restoreName = "ages_restore_" + suffix;
      await admin.query(`CREATE DATABASE "${restoreName}" OWNER "${role}"`);
      restored = true;
      const restoredUrl = new URL(env.DATABASE_URL!);
      restoredUrl.pathname = "/" + restoreName;
      await step(
        "05b-restore",
        ["exec", "node", "deploy/restore.mjs", dump, "--confirm-empty-target"],
        { ...backupEnv, DATABASE_URL: restoredUrl.toString() },
      );
      const refused = spawnSync(
        process.execPath,
        ["deploy/restore.mjs", dump, "--confirm-empty-target"],
        {
          env: { ...backupEnv, DATABASE_URL: restoredUrl.toString() },
          shell: false,
          stdio: "pipe",
        },
      );
      if (refused.status === 0)
        throw new Error("Restore accepted a populated database");
      const restoredClient = new Client({
        connectionString: restoredUrl.toString(),
      });
      await restoredClient.connect();
      try {
        if ((await databaseStatus(restoredClient)).length)
          throw new Error("Restore parity failed");
        const restoredPlayers = await restoredClient.query(
          'SELECT id,state FROM "Player" ORDER BY id',
        );
        if (JSON.stringify(saved.rows) !== JSON.stringify(restoredPlayers.rows))
          throw new Error("Restore changed player state");
      } finally {
        await restoredClient.end();
      }
    }
    const issues = await databaseStatus(probe);
    if (issues.length) throw new Error(issues.join("; "));
  } finally {
    await probe.end();
  }
  await step("06-fast", ["verify:fast"], env);
  await step("07-integration", ["test:integration"], env);
  await step("08-e2e", ["test:e2e"], env);
  await step("09-performance", ["test:performance"], env);
  writeFileSync(
    join(logs, "summary.json"),
    JSON.stringify(
      {
        ok: true,
        database: "unique disposable database",
        sequence: [
          "empty",
          "generate",
          "deploy",
          "seed",
          "repeat deploy/seed",
          "fast",
          "integration",
          "e2e",
          "performance",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Full clean-database verification passed; disposing only this run’s database and role.",
  );
} catch {
  process.exitCode = 1;
  console.error(
    "Full verification failed. See artifacts/release; no persistent application database was targeted.",
  );
} finally {
  try {
    if (restored)
      await admin?.query(`DROP DATABASE "ages_restore_${suffix}" WITH (FORCE)`);
    if (created) await admin?.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    if (backupRoleCreated) await admin?.query(`DROP ROLE "${backupRole}"`);
    if (roleCreated) await admin?.query(`DROP ROLE "${role}"`);
  } catch {
    process.exitCode = 1;
    console.error(
      `Disposable cleanup failed: administrator must inspect ${database} / ${role}`,
    );
  }
  await admin?.end().catch(() => undefined);
  if (started && bin && nativeDir)
    execute(join(bin, "pg_ctl.exe"), [
      "stop",
      "-D",
      join(nativeDir, "data"),
      "-m",
      "fast",
      "-w",
    ]);
  if (nativeDir) {
    const log = join(nativeDir, "postgres.log");
    if (existsSync(log))
      writeFileSync(join(logs, "postgres.log"), readFileSync(log));
    const target = resolve(nativeDir);
    if (
      !target.startsWith(root + sep) ||
      !target.split(sep).at(-1)?.startsWith("release-")
    ) {
      process.exitCode = 1;
      console.error("Unsafe native cleanup path; manual inspection required");
    } else rmSync(target, { recursive: true, force: true });
  }
}
