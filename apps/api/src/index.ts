/** HTTP and live boundary. Same-origin sessions, strict input validation, rate limits and opaque errors. */
import "dotenv/config";
import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import {
  randomBytes,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { prisma, closeDatabase } from "../../../packages/database/src/index.ts";
import {
  initialState,
  actionSchema,
  requireRule,
  RuleError,
  stateSchema,
  tick,
} from "../../../packages/engine/src/index.ts";
import {
  featureSchema,
  arrive,
  ledgerEntry,
} from "../../../packages/engine/src/chronicle.ts";
import { recordActivity } from "./telemetry.ts";
import {
  allowRate,
  PostgresPubSub,
  MemoryCache,
} from "../../../packages/infrastructure/src/index.ts";
import {
  perform,
  snapshot,
  worldAction,
  lockPlayers,
  notify,
  performFeature,
} from "./service.ts";
import type { WebSocket } from "ws";
import {
  runtimeConfig,
  errorKind,
  healthStats,
  operationLog,
} from "../../../packages/infrastructure/src/operations.ts";
import { readiness } from "./readiness.ts";
const env = runtimeConfig(process.env);
let draining = false;
const app = Fastify({
  logger: {
    serializers: {
      req: () => ({}),
      res: () => ({}),
      err: (error: unknown) => ({
        type: "Error",
        message: errorKind(error),
        stack: "",
        code: errorKind(error),
      }),
    },
    redact: [
      "req.headers.cookie",
      "req.headers.authorization",
      "res.headers.set-cookie",
    ],
  },
  logController: new LogController({ disableRequestLogging: true }),
  genReqId: () => randomUUID(),
  bodyLimit: 16384,
  trustProxy: env.NODE_ENV === "production" ? "127.0.0.1" : false,
  requestTimeout: 15000,
  connectionTimeout: 20000,
  return503OnClosing: true,
});
app.addHook("onResponse", async (req, reply) => {
  const duration = Math.round(reply.elapsedTime);
  healthStats.requests++;
  healthStats.totalLatencyMs += duration;
  healthStats.maxLatencyMs = Math.max(healthStats.maxLatencyMs, duration);
  if (reply.statusCode >= 500) healthStats.errors++;
  req.log.info({
    event: "http_response",
    requestId: req.id,
    route: req.routeOptions.url ?? "unmatched",
    method: req.method,
    status: reply.statusCode,
    durationMs: duration,
  });
});
await app.register(cookie);
await app.register(websocket, { options: { maxPayload: 4096 } });
const pubsub = new PostgresPubSub(),
  cache = new MemoryCache();
const peers = new Map<
  WebSocket,
  { id: string; expires: number; token: string; alive: boolean }
>();
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
async function authenticate(token?: string) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: hash(token) },
  });
  return session && session.expiresAt.getTime() > Date.now() ? session : null;
}
const authBody = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
    name: z.string().trim().min(2).max(24).optional(),
  })
  .strict();
declare module "fastify" {
  interface FastifyRequest {
    playerId: string;
  }
}
app.decorateRequest("playerId", "");
app.addHook("onRequest", async (req, reply) => {
  reply
    .header("X-Content-Type-Options", "nosniff")
    .header("Cache-Control", "no-store")
    .header("X-Request-ID", req.id)
    .header("Referrer-Policy", "no-referrer")
    .header("X-Frame-Options", "DENY")
    .header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    .header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
  if (env.NODE_ENV === "production")
    reply.header("Strict-Transport-Security", "max-age=31536000");
  if (draining) return reply.code(503).send({ error: "Service draining" });
  if (["/api/live", "/api/health", "/api/ready"].includes(req.url)) return;
  if (req.url === "/internal/metrics") {
    const supplied = req.headers.authorization ?? "",
      expected = "Bearer " + env.OPS_TOKEN;
    if (
      !env.OPS_TOKEN ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      return reply.code(404).send({ error: "Not found" });
    return;
  }
  if (req.headers.origin && req.headers.origin !== env.APP_ORIGIN)
    return reply.code(403).send({ error: "Origin rejected" });
  if (!(await allowRate(`ip:${req.ip}`, 300, 60)))
    return reply.code(429).send({ error: "Slow down" });
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== env.APP_ORIGIN
  )
    return reply.code(403).send({ error: "Origin rejected" });
  if (req.url.startsWith("/api/auth/") || req.url === "/api/health") return;
  const session = await authenticate(req.cookies.refresh);
  if (!session) return reply.code(401).send({ error: "Sign in to continue" });
  req.playerId = session.playerId;
});
app.setErrorHandler((error, req, reply) => {
  req.log.error({
    event: "request_error",
    requestId: req.id,
    code: errorKind(error),
  });
  const typed = error as Error & { code?: string };
  if (error instanceof z.ZodError)
    return reply.code(400).send({
      error: "Invalid request",
      issues: error.issues.map((i) => i.message),
    });
  if (typed.code === "P2002")
    return reply.code(409).send({ error: "Already exists or nonce collision" });
  if (typed.code === "P2025")
    return reply.code(404).send({ error: "Not found" });
  const safe = error instanceof RuleError;
  reply
    .code(safe ? 400 : 500)
    .send({ error: safe ? typed.message : "Request failed; try again" });
});
async function issueSession(
  playerId: string,
  reply: import("fastify").FastifyReply,
) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      token: hash(token),
      playerId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  reply.setCookie("refresh", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400,
  });
}
app.get("/api/live", async () => ({ ok: !draining }));
app.get("/api/ready", async (_req, reply) => {
  const status = await readiness();
  return reply.code(status.ok ? 200 : 503).send(status);
});
app.get("/internal/metrics", async () => ({
  ...healthStats,
  webSockets: peers.size,
  readiness: await readiness(),
  worker: await prisma.operationalStatus.findMany(),
}));
app.get("/api/health", async (_req, reply) => {
  const status = await readiness(false);
  return reply.code(status.ok ? 200 : 503).send({ ok: status.ok });
});
app.post("/api/auth/guest", async (req, reply) => {
  z.object({})
    .strict()
    .parse(req.body ?? {});
  requireRule(
    await allowRate(`auth:${req.ip}`, 10, 3600),
    "Too many account attempts",
  );
  const player = await prisma.player.create({
    data: {
      name: `Wayfarer-${randomBytes(3).toString("hex")}`,
      state: initialState(Date.now()),
    },
  });
  await issueSession(player.id, reply);
  return { ok: true };
});
app.post("/api/auth/register", async (req, reply) => {
  const body = authBody.parse(req.body);
  requireRule(
    await allowRate(`auth:${req.ip}`, 10, 3600),
    "Too many account attempts",
  );
  const password = await argon2.hash(body.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const session = await authenticate(req.cookies.refresh);
  const player = await prisma.$transaction(async (tx) => {
    if (session) {
      await lockPlayers(tx, [session.playerId]);
      const old = await tx.player.findUniqueOrThrow({
        where: { id: session.playerId },
      });
      requireRule(!old.email, "Account already registered");
      return tx.player.update({
        where: { id: old.id },
        data: { email: body.email, password, name: body.name ?? old.name },
      });
    }
    return tx.player.create({
      data: {
        email: body.email,
        password,
        name: body.name ?? "Wayfarer",
        state: initialState(Date.now()),
      },
    });
  });
  if (session)
    await prisma.session.deleteMany({ where: { playerId: player.id } });
  await issueSession(player.id, reply);
  return { ok: true };
});
app.post("/api/auth/login", async (req, reply) => {
  const body = authBody.parse(req.body);
  requireRule(
    await allowRate(`login:${req.ip}`, 10, 60),
    "Too many login attempts",
  );
  const player = await prisma.player.findUnique({
    where: { email: body.email },
  });
  requireRule(
    player?.password && (await argon2.verify(player.password, body.password)),
    "Invalid email or password",
  );
  await issueSession(player.id, reply);
  return { ok: true };
});
app.post("/api/auth/refresh", async (req, reply) => {
  z.object({})
    .strict()
    .parse(req.body ?? {});
  const session = await authenticate(req.cookies.refresh);
  requireRule(session, "Session expired");
  const deleted = await prisma.session.deleteMany({
    where: { token: session.token },
  });
  requireRule(deleted.count === 1, "Session already rotated");
  await issueSession(session.playerId, reply);
  return { ok: true };
});
app.post("/api/auth/logout", async (req, reply) => {
  z.object({})
    .strict()
    .parse(req.body ?? {});
  if (req.cookies.refresh)
    await prisma.session.deleteMany({
      where: { token: hash(req.cookies.refresh) },
    });
  reply.clearCookie("refresh", { path: "/" });
  if (req.cookies.refresh)
    for (const [socket, peer] of peers)
      if (peer.token === hash(req.cookies.refresh))
        socket.close(1008, "Signed out");
  return { ok: true };
});
app.get("/api/me", async (req) =>
  snapshot(req.playerId, req.headers["x-ages-visible"] !== "false"),
);
app.post("/api/feature", async (req) => {
  requireRule(
    await allowRate(`action:${req.playerId}`, 60, 60),
    "Action rate exceeded",
  );
  return performFeature(req.playerId, featureSchema.parse(req.body));
});
app.post("/api/action", async (req) => {
  requireRule(
    await allowRate(`action:${req.playerId}`, 60, 60),
    "Action rate exceeded",
  );
  return perform(req.playerId, actionSchema.parse(req.body));
});
app.post("/api/world", async (req) => {
  requireRule(
    await allowRate(`action:${req.playerId}`, 60, 60),
    "Action rate exceeded",
  );
  const body = z
    .object({ nonce: z.uuid(), claim: z.boolean() })
    .strict()
    .parse(req.body);
  return worldAction(req.playerId, body.nonce, body.claim);
});
app.get("/api/world", async (req) => ({
  boss: await prisma.world.findUnique({ where: { id: "leviathan" } }),
  contributions: await prisma.contribution.findMany({
    where: { playerId: req.playerId },
    take: 10,
    orderBy: { cycle: "desc" },
  }),
}));
app.get("/api/players", async () => {
  const rows = await prisma.player.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, state: true, guildId: true },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    guildId: p.guildId,
    level: (p.state as { level: number }).level,
  }));
});
app.get("/api/leaderboard", async () => {
  const cached = cache.get("leaders");
  if (cached) return cached;
  const result = await prisma.leaderboard.findMany({
    take: 50,
    orderBy: { score: "desc" },
  });
  cache.set("leaders", result);
  return result;
});
app.get("/api/bounties", async () =>
  prisma.bounty.findMany({
    where: { claimedBy: null },
    take: 50,
    orderBy: { createdAt: "desc" },
  }),
);
app.get(
  "/api/territory",
  async () =>
    prisma.$queryRaw`SELECT era, COALESCE(g."name",p."name") AS controller, SUM((p.state->'influence'->>era)::int)::int AS influence FROM "Player" p LEFT JOIN "Guild" g ON g.id=p."guildId" CROSS JOIN generate_series(0,3) era WHERE (p.state->>'season')::int=floor(extract(epoch from now())*1000/2592000000) GROUP BY era,COALESCE(g."name",p."name") ORDER BY era,influence DESC LIMIT 200`,
);
app.get("/api/social", async (req) => ({
  guilds: await prisma.guild.findMany({ take: 50 }),
  wars: await prisma.war.findMany({
    where: { expiresAt: { gt: new Date() } },
    take: 50,
  }),
  relations: await prisma.relation.findMany({
    where: { playerId: req.playerId },
  }),
}));
const social = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("guild-create"),
      name: z.string().trim().min(3).max(32),
    })
    .strict(),
  z.object({ type: z.literal("guild-join"), id: z.uuid() }).strict(),
  z.object({ type: z.literal("war"), id: z.uuid() }).strict(),
  z
    .object({
      type: z.literal("relation"),
      id: z.uuid(),
      kind: z.enum(["friend", "rival"]),
    })
    .strict(),
]);
app.post("/api/social", async (req) => {
  const body = social.parse(req.body);
  requireRule(
    await allowRate(`social:${req.playerId}`, 10, 60),
    "Social rate exceeded",
  );
  return prisma.$transaction(async (tx) => {
    await lockPlayers(tx, [req.playerId]);
    const player = await tx.player.findUniqueOrThrow({
      where: { id: req.playerId },
    });
    if (body.type === "guild-create") {
      requireRule(!player.guildId, "Already in an order");
      const guild = await tx.guild.create({
        data: { name: body.name, ownerId: player.id },
      });
      await tx.player.update({
        where: { id: player.id },
        data: { guildId: guild.id },
      });
    }
    if (body.type === "guild-join") {
      requireRule(!player.guildId, "Already in an order");
      await tx.guild.findUniqueOrThrow({ where: { id: body.id } });
      await tx.player.update({
        where: { id: player.id },
        data: { guildId: body.id },
      });
    }
    if (body.type === "war") {
      requireRule(
        player.guildId && player.guildId !== body.id,
        "Select another order",
      );
      const guild = await tx.guild.findUniqueOrThrow({
        where: { id: player.guildId },
      });
      requireRule(
        guild.ownerId === player.id,
        "Only the founder declares wars",
      );
      await tx.guild.findUniqueOrThrow({ where: { id: body.id } });
      await tx.war.upsert({
        where: {
          attackerId_defenderId: {
            attackerId: player.guildId,
            defenderId: body.id,
          },
        },
        create: {
          attackerId: player.guildId,
          defenderId: body.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
        update: { expiresAt: new Date(Date.now() + 86400000) },
      });
    }
    if (body.type === "relation") {
      requireRule(body.id !== player.id, "Choose another operator");
      await tx.player.findUniqueOrThrow({ where: { id: body.id } });
      await tx.relation.upsert({
        where: { playerId_otherId: { playerId: player.id, otherId: body.id } },
        create: { playerId: player.id, otherId: body.id, kind: body.kind },
        update: { kind: body.kind },
      });
    }
    await tx.audit.create({
      data: { playerId: player.id, action: body.type, detail: body },
    });
    await notify(tx, player.id);
    return { message: "Social ledger updated" };
  });
});
async function channelFor(playerId: string, channel: string) {
  if (channel === "world") return channel;
  if (channel === "guild") {
    const p = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
    });
    requireRule(p.guildId, "Join an order");
    return `guild:${p.guildId}`;
  }
  if (channel.startsWith("mail:")) {
    const other = z.uuid().parse(channel.slice(5));
    await prisma.player.findUniqueOrThrow({ where: { id: other } });
    return `mail:${[playerId, other].sort().join(":")}`;
  }
  throw new RuleError("Unknown channel");
}
app.get("/api/messages", async (req) => {
  const q = z
    .object({ channel: z.string().max(80).default("world") })
    .parse(req.query);
  return prisma.message.findMany({
    where: { channel: await channelFor(req.playerId, q.channel) },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
});
app.post("/api/messages", async (req) => {
  requireRule(
    await allowRate(`chat:${req.playerId}`, 10, 60),
    "Chat rate exceeded",
  );
  const body = z
    .object({
      channel: z.string().max(80),
      body: z.string().trim().min(1).max(500),
    })
    .strict()
    .parse(req.body);
  const channel = await channelFor(req.playerId, body.channel);
  await prisma.$transaction(async (tx) => {
    await lockPlayers(tx, [req.playerId]);
    const player = await tx.player.findUniqueOrThrow({
      where: { id: req.playerId },
    });
    await tx.message.create({
      data: {
        senderId: player.id,
        senderName: player.name,
        channel,
        body: body.body,
      },
    });
    const now = Date.now(),
      state = tick(stateSchema.parse(player.state), now);
    arrive(state, now);
    ledgerEntry(state, "message", "A sealed message was dispatched", now);
    await recordActivity(tx, player.id, state, now, "message");
    await tx.player.update({
      where: { id: player.id },
      data: { state: stateSchema.parse(state) },
    });
    await tx.audit.create({
      data: { playerId: player.id, action: "message", detail: { channel } },
    });
    await notify(tx, player.id);
  });
  await pubsub.publish({ type: "chat", channel });
  return { message: "Message sent" };
});
app.get("/live", { websocket: true }, async (socket, req) => {
  if (req.headers.origin !== env.APP_ORIGIN) {
    socket.close(1008, "Origin rejected");
    return;
  }
  const session = await authenticate(req.cookies.refresh);
  if (!session) {
    socket.close(1008, "Session expired");
    return;
  }
  if (
    [...peers.values()].filter((p) => p.id === session.playerId).length >= 3
  ) {
    socket.close(1008, "Connection limit");
    return;
  }
  peers.set(socket, {
    id: session.playerId,
    expires: session.expiresAt.getTime(),
    token: session.token,
    alive: true,
  });
  healthStats.wsConnections++;
  socket.on("pong", () => {
    const peer = peers.get(socket);
    if (peer) peer.alive = true;
  });
  socket.on("close", () => peers.delete(socket));
  socket.on("error", () => {
    healthStats.wsDropped++;
    peers.delete(socket);
  });
  socket.send(JSON.stringify({ type: "state" }));
});
await pubsub.start((event) => {
  cache.delete("leaders");
  for (const [socket, peer] of peers) {
    if (peer.expires < Date.now()) {
      socket.close(1008, "Expired");
      continue;
    }
    if (event.playerId && event.playerId !== peer.id) continue;
    if (socket.readyState === 1 && socket.bufferedAmount < 65536)
      socket.send(JSON.stringify({ type: event.type }));
    else healthStats.wsDropped++;
  }
});
const heartbeat = setInterval(() => {
  for (const socket of peers.keys()) {
    const peer = peers.get(socket);
    if (peer && !peer.alive) {
      healthStats.wsDropped++;
      socket.terminate();
      peers.delete(socket);
      continue;
    }
    if (peer) peer.alive = false;
    if (socket.readyState === 1) socket.ping();
    else peers.delete(socket);
  }
}, 30000);
await app.listen({ port: env.PORT, host: env.HOST });

async function shutdown() {
  if (draining) return;
  draining = true;
  operationLog("api_draining");
  clearInterval(heartbeat);
  const deadline = setTimeout(() => {
    operationLog("api_shutdown_timeout");
    process.exit(1);
  }, 25000);
  deadline.unref();
  const closeSockets = setTimeout(() => {
    for (const socket of peers.keys()) socket.terminate();
  }, 1000);
  closeSockets.unref();
  try {
    for (const socket of peers.keys()) socket.close(1001, "Restart");
    await app.close();
    await pubsub.stop();
    await closeDatabase();
    operationLog("api_stopped");
  } catch (error) {
    operationLog("api_shutdown_failed", { code: errorKind(error) });
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    clearTimeout(closeSockets);
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void shutdown());
