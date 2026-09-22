/** Operational diagnostics contain bounded categories and numbers, never request bodies or error messages. */
import { z } from "zod";
export function runtimeConfig(input: NodeJS.ProcessEnv) {
  const config = z
    .object({
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      APP_ORIGIN: z.url().default("http://localhost:5173"),
      HOST: z.string().default("127.0.0.1"),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
      ANALYTICS_ENABLED: z.enum(["true", "false"]).default("false"),
      OPS_TOKEN: z.string().default(""),
      DATABASE_URL: z.string().min(1),
    })
    .parse(input);
  const url = new URL(config.DATABASE_URL),
    origin = new URL(config.APP_ORIGIN);
  if (
    config.NODE_ENV === "production" &&
    (origin.protocol !== "https:" ||
      origin.origin !== config.APP_ORIGIN ||
      config.HOST !== "127.0.0.1" ||
      config.OPS_TOKEN.length < 32 ||
      /^REPLACE/.test(config.OPS_TOKEN) ||
      !url.password ||
      /REPLACE_ME|dev_only/i.test(url.password) ||
      input.PG_ADMIN_URL ||
      input.MIGRATION_DATABASE_URL)
  )
    throw new Error("Unsafe production configuration; see release runbook");
  return config;
}
export function errorKind(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,24}$/.test(code)
    ? code
    : "INTERNAL_ERROR";
}
export function operationLog(
  event: string,
  fields: Record<string, number | string | boolean> = {},
) {
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...fields }),
  );
}
export const healthStats = {
  requests: 0,
  errors: 0,
  totalLatencyMs: 0,
  maxLatencyMs: 0,
  wsConnections: 0,
  wsDropped: 0,
  jobFailures: 0,
  jobRetries: 0,
  jobLagMs: 0,
  jobDurationMs: 0,
};
