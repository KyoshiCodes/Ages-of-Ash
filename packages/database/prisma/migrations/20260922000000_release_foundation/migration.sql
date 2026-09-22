-- Additive operational heartbeat; no player progress or ledger history is modified.
CREATE TABLE "OperationalStatus" (
 "name" TEXT PRIMARY KEY,
 "lastSuccessAt" TIMESTAMPTZ(6),
 "lastFailureAt" TIMESTAMPTZ(6),
 "running" BOOLEAN NOT NULL DEFAULT false,
 "durationMs" INTEGER NOT NULL DEFAULT 0,
 "lagMs" INTEGER NOT NULL DEFAULT 0,
 "failures" INTEGER NOT NULL DEFAULT 0
);
