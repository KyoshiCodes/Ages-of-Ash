/** Shared database pools. Keep per-process pools small for a 16 GB development machine. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
export const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL missing; copy .env.example to .env");
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 5 }),
});
export const pool = new pg.Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 5000,
});
export async function closeDatabase() {
  await prisma.$disconnect();
  await pool.end();
}
