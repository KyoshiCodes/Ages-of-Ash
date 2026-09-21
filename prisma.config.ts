/** Prisma CLI configuration; runtime credentials stay in environment. */
import "dotenv/config";
import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: "packages/database/prisma/schema.prisma",
  migrations: {
    path: "packages/database/prisma/migrations",
    seed: "tsx packages/database/src/seed.ts",
  },
  datasource: { url: env("DATABASE_URL") },
});
