/** Idempotent database bootstrap. Admin credentials are optional and never printed. */
import "dotenv/config";
import { Client } from "pg";
const url = new URL(
  process.env.DATABASE_URL ??
    "postgresql://ages:ages_dev_only@localhost:5432/ages",
);
const role = decodeURIComponent(url.username),
  database = url.pathname.slice(1);
if (!/^[a-z][a-z0-9_]*$/.test(role) || !/^[a-z][a-z0-9_]*$/.test(database))
  throw new Error("Database and role must be lowercase identifiers");
if (process.env.PG_ADMIN_URL) {
  const admin = new Client({ connectionString: process.env.PG_ADMIN_URL });
  await admin.connect();
  const password = decodeURIComponent(url.password).replaceAll("'", "''");
  if (
    !(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
      .rowCount
  )
    await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
  if (
    !(
      await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [
        database,
      ])
    ).rowCount
  )
    await admin.query(`CREATE DATABASE "${database}" OWNER "${role}"`);
  await admin.end();
}
const app = new Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 5000,
});
await app.connect();
await app.query("SELECT 1");
await app.end();
console.log(
  "Role/database connectivity ready. Review and explicitly run pnpm db:generate, pnpm db:deploy, and pnpm db:seed.",
);
