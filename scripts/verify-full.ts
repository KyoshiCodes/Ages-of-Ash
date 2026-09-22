/** Disposable-database acceptance runner. Never reads DATABASE_URL or migrates an existing application database. */
import { Client } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve, join, sep } from "node:path";
import { commandSpec, execute } from "./process.ts";
import { databaseStatus, clientStatus } from "./database-status.ts";
import {
  findPostgresClientBin,
  verifyPostgresClients,
} from "./postgres-client.ts";
import {
  restoreSnapshot,
  assertRestoreParity,
  assertPopulatedRestoreRejected,
} from "./restore-parity.ts";
const suffix = randomBytes(8).toString("hex"),
  database = `ages_verify_${suffix}`,
  role = `ages_verify_${suffix}`,
  backupRole = `ages_backup_${suffix}`;
const logs = resolve("artifacts/release", suffix);
mkdirSync(logs, { recursive: true });
const root = resolve(".local");
mkdirSync(root, { recursive: true });
let nativeDir: string | undefined,
  backupDir: string | undefined,
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
    bin = findPostgresClientBin();
    if (!bin || !existsSync(join(bin, "initdb.exe")))
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
  if (
    process.env.CI === "true" &&
    (url.hostname !== "127.0.0.1" ||
      url.port !== "5432" ||
      url.pathname !== "/postgres" ||
      url.username !== "verification_admin" ||
      url.search !== "")
  )
    throw new Error(
      "CI verification requires its loopback service bootstrap URL",
    );
  admin = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  const clientBin = findPostgresClientBin();
  if (!clientBin) throw new Error("PostgreSQL 18 client tools are missing");
  const serverVersion = Number(
    (await admin.query("SHOW server_version_num")).rows[0].server_version_num,
  );
  const clientVersions = verifyPostgresClients(
    clientBin,
    Math.floor(serverVersion / 10000),
  );
  console.log(
    `PostgreSQL server ${Math.floor(serverVersion / 10000)}.${serverVersion % 10000}; clients: ${Object.entries(
      clientVersions,
    )
      .map(([name, version]) => `${name} ${version}`)
      .join(", ")}`,
  );
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

    for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
      const grant = await probe.query(
        "SELECT has_table_privilege($1, $2, $3) AS allowed",
        [backupRole, 'public."Player"', privilege],
      );
      if (grant.rows[0].allowed)
        throw new Error("Read-only backup role has player write access");
    }
    const runtimePrivilege = await admin.query(
      "SELECT rolsuper,rolcreatedb,rolcreaterole,pg_has_role($1, 'pg_read_all_data', 'member') AS backup_member,pg_has_role($1, $2, 'member') AS backup_role_member FROM pg_roles WHERE rolname=$1",
      [role, backupRole],
    );
    if (
      runtimePrivilege.rows[0].rolsuper ||
      runtimePrivilege.rows[0].rolcreatedb ||
      runtimePrivilege.rows[0].rolcreaterole ||
      runtimePrivilege.rows[0].backup_member ||
      runtimePrivilege.rows[0].backup_role_member
    )
      throw new Error(
        "Runtime verification role gained operator or backup privileges",
      );

    const playerId = saved.rows[0]?.id as string | undefined;
    if (!playerId)
      throw new Error("Canonical seed lacks a restore-test player");
    const sessionId = randomUUID();
    await probe.query(
      'INSERT INTO "PlaySession" (id,"playerId","startedAt","lastAt",operations,"lastStep") VALUES ($1,$2,now(),now(),1,$3)',
      [sessionId, playerId, "restore-check"],
    );
    await probe.query(
      'INSERT INTO "TelemetryEvent" ("playerId","sessionId",type,value) VALUES ($1,$2,$3,$4)',
      [playerId, sessionId, "restore-check", 1],
    );
    await probe.query(
      'INSERT INTO "OperationalStatus" (name,running,"durationMs","lagMs",failures) VALUES ($1,false,12,3,0)',
      ["release_restore_" + suffix],
    );
    const sourceSnapshot = await restoreSnapshot(probe);
    if (
      !sourceSnapshot.content.length ||
      !sourceSnapshot.players.length ||
      !sourceSnapshot.playSessions.length ||
      !sourceSnapshot.telemetry.length ||
      !sourceSnapshot.operational.length
    )
      throw new Error("Restore source fixtures are incomplete");

    backupDir = nativeDir
      ? join(nativeDir, "backups")
      : mkdtempSync(join(root, "release-backups-"));
    const backupEnv = {
      ...env,
      DATABASE_URL: backupUrl.toString(),
      PG_BIN: clientBin,
      BACKUP_DIR: backupDir,
    };
    await step("05a-backup", ["exec", "node", "deploy/backup.mjs"], backupEnv);
    const dumpName = readdirSync(backupDir).find((name) =>
      name.endsWith(".dump"),
    );
    if (!dumpName)
      throw new Error("Backup did not create a custom-format dump");
    const dump = join(backupDir, dumpName);
    if (
      statSync(dump).size <= 5 ||
      readFileSync(dump).subarray(0, 5).toString("ascii") !== "PGDMP"
    )
      throw new Error(
        "Backup artifact is empty or not a PostgreSQL custom dump",
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
    console.log("=== 05c-restore-refusal ===");
    const refused = spawnSync(
      process.execPath,
      ["deploy/restore.mjs", dump, "--confirm-empty-target"],
      {
        env: { ...backupEnv, DATABASE_URL: restoredUrl.toString() },
        shell: false,
        stdio: "pipe",
      },
    );
    assertPopulatedRestoreRejected(refused);
    writeFileSync(
      join(logs, "05c-restore-refusal.log"),
      "Populated restore target refused by empty-target guard.\n",
    );
    const restoredClient = new Client({
      connectionString: restoredUrl.toString(),
    });
    await restoredClient.connect();
    try {
      if ((await databaseStatus(restoredClient)).length)
        throw new Error("Restored database failed migration/content readiness");
      assertRestoreParity(
        sourceSnapshot,
        await restoreSnapshot(restoredClient),
      );
    } finally {
      await restoredClient.end();
    }
    console.log(
      "Backup/restore parity passed for schema, migrations, content, players, sessions, telemetry and operational status.",
    );
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
        postgresClients: clientVersions,
        backupRestore: "passed",
        sequence: [
          "empty",
          "generate",
          "deploy",
          "seed",
          "repeat deploy/seed",
          "backup/restore/refusal",
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
  let cleanupOk = true;
  for (const [enabled, label, sql] of [
    [
      restored,
      "restore database",
      'DROP DATABASE "ages_restore_' + suffix + '" WITH (FORCE)',
    ],
    [
      created,
      "source database",
      'DROP DATABASE "' + database + '" WITH (FORCE)',
    ],
    [backupRoleCreated, "backup role", 'DROP ROLE "' + backupRole + '"'],
    [roleCreated, "runtime role", 'DROP ROLE "' + role + '"'],
  ] as const) {
    if (!enabled) continue;
    try {
      await admin?.query(sql);
    } catch {
      cleanupOk = false;
      process.exitCode = 1;
      console.error(
        "Could not remove disposable " +
          label +
          "; inspect this verification run.",
      );
    }
  }
  await admin?.end().catch(() => {
    cleanupOk = false;
    process.exitCode = 1;
    console.error("Could not close disposable administrator connection.");
  });
  let stopped = true;
  if (started && bin && nativeDir) {
    try {
      execute(join(bin, "pg_ctl.exe"), [
        "stop",
        "-D",
        join(nativeDir, "data"),
        "-m",
        "fast",
        "-w",
      ]);
    } catch {
      stopped = false;
      cleanupOk = false;
      process.exitCode = 1;
      console.error(
        "Could not stop disposable native cluster; inspect .local manually.",
      );
    }
  }
  const removeDisposable = (directory: string, prefix: string) => {
    const target = resolve(directory);
    if (
      !target.startsWith(root + sep) ||
      !target.split(sep).at(-1)?.startsWith(prefix)
    ) {
      cleanupOk = false;
      process.exitCode = 1;
      console.error(
        "Unsafe disposable cleanup path; manual inspection required",
      );
      return;
    }
    try {
      rmSync(target, { recursive: true, force: true });
    } catch {
      cleanupOk = false;
      process.exitCode = 1;
      console.error(
        "Could not remove disposable files; inspect .local manually.",
      );
    }
  };
  if (backupDir && !nativeDir) removeDisposable(backupDir, "release-backups-");
  if (nativeDir && stopped) {
    const log = join(nativeDir, "postgres.log");
    if (existsSync(log))
      writeFileSync(join(logs, "postgres.log"), readFileSync(log));
    removeDisposable(nativeDir, "release-");
  }
  if (cleanupOk) console.log("Disposable roles, databases and files removed.");
}
