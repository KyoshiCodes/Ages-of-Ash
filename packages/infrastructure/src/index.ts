/** Infrastructure adapters. Notifications are invalidations, never durable reward delivery. */
import { LRUCache } from "lru-cache";
import { PgBoss } from "pg-boss";
import pg from "pg";
import { z } from "zod";
import { connectionString, pool } from "../../database/src/index.ts";
export interface CacheStore {
  get(key: string): unknown;
  set(key: string, value: object): void;
  delete(key: string): void;
}
export class MemoryCache implements CacheStore {
  private cache = new LRUCache<string, object>({ max: 500, ttl: 5000 });
  get(key: string) {
    return this.cache.get(key);
  }
  set(key: string, value: object) {
    this.cache.set(key, value);
  }
  delete(key: string) {
    this.cache.delete(key);
  }
}
export interface QueueDriver {
  start(): Promise<void>;
  schedule(
    name: string,
    cron: string,
    handler: () => Promise<void>,
  ): Promise<void>;
  stop(): Promise<void>;
}
export class PostgresQueue implements QueueDriver {
  private boss = new PgBoss({ connectionString: connectionString!, max: 2 });
  constructor() {
    this.boss.on("error", (error) => console.error("Queue error", error));
  }
  async start() {
    await this.boss.start();
  }
  async schedule(name: string, cron: string, handler: () => Promise<void>) {
    await this.boss.createQueue(name);
    await this.boss.work(name, async () => {
      await handler();
    });
    await this.boss.schedule(name, cron, {}, { singletonKey: name });
  }
  async stop() {
    await this.boss.stop();
  }
}
export interface LiveEvent {
  type: "state" | "chat" | "world" | "leaderboard";
  playerId?: string;
  channel?: string;
}
const liveSchema = z
  .object({
    type: z.enum(["state", "chat", "world", "leaderboard"]),
    playerId: z.uuid().optional(),
    channel: z.string().max(120).optional(),
  })
  .strict();
export interface PubSub {
  start(handler: (event: LiveEvent) => void): Promise<void>;
  publish(event: LiveEvent): Promise<void>;
  stop(): Promise<void>;
}
export class PostgresPubSub implements PubSub {
  private client: pg.Client | undefined;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  async start(handler: (event: LiveEvent) => void) {
    if (this.closed) return;
    const client = new pg.Client({ connectionString });
    this.client = client;
    client.on("notification", (msg) => {
      if (msg.payload)
        try {
          handler(liveSchema.parse(JSON.parse(msg.payload)));
        } catch {
          console.error("Malformed notification");
        }
    });
    client.on("error", () => {
      void client.end().catch(() => undefined);
    });
    client.on("end", () => {
      if (!this.closed)
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.start(handler).catch(() => undefined);
        }, 2000);
    });
    try {
      await client.connect();
      await client.query("LISTEN ages_live");
      handler({ type: "world" });
    } catch (error) {
      await client.end().catch(() => undefined);
      if (!this.closed && !this.timer)
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.start(handler).catch(() => undefined);
        }, 2000);
      throw error;
    }
  }
  async publish(event: LiveEvent) {
    await pool.query("SELECT pg_notify($1,$2)", [
      "ages_live",
      JSON.stringify(event),
    ]);
  }
  async stop() {
    this.closed = true;
    clearTimeout(this.timer);
    await this.client?.end();
  }
}
export async function allowRate(key: string, limit: number, seconds: number) {
  const result = await pool.query<{ count: number }>(
    `INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES ($1,1,now()+$2*interval '1 second') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<=now() THEN 1 ELSE "RateLimit"."count"+1 END, "expiresAt"=CASE WHEN "RateLimit"."expiresAt"<=now() THEN now()+$2*interval '1 second' ELSE "RateLimit"."expiresAt" END RETURNING "count"`,
    [key, seconds],
  );
  return result.rows[0].count <= limit;
}
