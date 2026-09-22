/** Read-only migration checksum, catalog parity and generated-client schema checks. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";
import type { Client } from "pg";
import { canonicalCatalog } from "../packages/gamedata/src/catalog.ts";
export async function databaseStatus(client: Client) {
  const issues: string[] = [];
  const table = await client.query(
    "SELECT to_regclass('public._prisma_migrations') AS name",
  );
  const applied = table.rows[0].name
    ? (
        await client.query(
          'SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"',
        )
      ).rows
    : [];
  const root = "packages/database/prisma/migrations";
  const local = readdirSync(root, { withFileTypes: true })
    .filter((x) => x.isDirectory())
    .map((x) => x.name);
  for (const name of local) {
    const row = applied.find(
      (x) => x.migration_name === name && x.finished_at && !x.rolled_back_at,
    );
    if (!row) issues.push(`Pending or failed migration: ${name}`);
    else if (
      row.checksum !==
      createHash("sha256")
        .update(readFileSync(join(root, name, "migration.sql")))
        .digest("hex")
    )
      issues.push(`Migration checksum mismatch: ${name}`);
  }
  if (applied.some((x) => !x.finished_at && !x.rolled_back_at))
    issues.push(
      "Unresolved failed migration; inspect with prisma migrate status",
    );
  if (applied.some((x) => x.finished_at && !local.includes(x.migration_name)))
    issues.push("Database contains migrations absent from this checkout");
  const content = await client.query(
    `SELECT to_regclass('public."ContentDefinition"') AS name`,
  );
  const rows = content.rows[0].name
    ? (await client.query('SELECT key,definition FROM "ContentDefinition"'))
        .rows
    : [];
  for (const entry of canonicalCatalog()) {
    const row = rows.find((x) => x.key === entry.key);
    if (!row) issues.push(`Missing canonical content: ${entry.key}`);
    else if (!isDeepStrictEqual(row.definition, entry.definition))
      issues.push(`Stale canonical content: ${entry.key}`);
  }
  const world = await client.query(
    `SELECT to_regclass('public."World"') AS name`,
  );
  if (
    !world.rows[0].name ||
    !(await client.query('SELECT 1 FROM "World" WHERE id=$1', ["leviathan"]))
      .rowCount
  )
    issues.push("Missing canonical world boss");
  return issues;
}
export function clientStatus() {
  try {
    const require = createRequire(import.meta.url),
      entry = require.resolve("@prisma/client");
    const generated = resolve(
      dirname(entry),
      "../../.prisma/client/schema.prisma",
    );
    if (!existsSync(generated))
      return "Generated Prisma schema unavailable; run pnpm db:generate";
    const normalize = (text: string) =>
      text.replace(/"(?:[^"\\]|\\.)*"|\s+/g, (part) =>
        part.startsWith('"') ? part : "",
      );
    if (
      normalize(readFileSync(generated, "utf8")) !==
      normalize(readFileSync("packages/database/prisma/schema.prisma", "utf8"))
    )
      return "Generated Prisma client differs from schema; run pnpm db:generate";
    const pkg = JSON.parse(
      readFileSync(require.resolve("@prisma/client/package.json"), "utf8"),
    ) as { version: string };
    return pkg.version === "7.10.0" ? null : "Prisma client must be 7.10.0";
  } catch {
    return "Generated Prisma client unavailable; run pnpm db:generate";
  }
}
