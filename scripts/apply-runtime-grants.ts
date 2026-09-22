/** Explicit release-time grants using the migration owner; no runtime role owns the public schema. */
import "dotenv/config";
import { Client } from "pg";
import { readFileSync } from "node:fs";
if (
  !process.argv.includes("--approved") ||
  new URL(process.env.DATABASE_URL!).pathname !== "/ages"
)
  throw new Error(
    "Requires --approved, migration-owner DATABASE_URL and the production ages database",
  );
const client = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(readFileSync("deploy/database-grants.sql", "utf8"));
  console.log("Runtime grants applied.");
} finally {
  await client.end();
}
