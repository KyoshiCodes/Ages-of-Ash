-- Catalog snapshots are seeded from validated authored data; telemetry contains no message content.
CREATE TABLE "ContentDefinition" ("key" TEXT PRIMARY KEY,"kind" TEXT NOT NULL,"definition" JSONB NOT NULL);
CREATE TABLE "PlaySession" ("id" UUID PRIMARY KEY,"playerId" UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,"startedAt" TIMESTAMPTZ(6) NOT NULL,"lastAt" TIMESTAMPTZ(6) NOT NULL,"operations" INT NOT NULL DEFAULT 0,"lastStep" TEXT NOT NULL DEFAULT 'arrival');
CREATE INDEX "PlaySession_playerId_startedAt_idx" ON "PlaySession"("playerId","startedAt");
CREATE TABLE "TelemetryEvent" ("id" BIGSERIAL PRIMARY KEY,"playerId" UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,"sessionId" UUID NOT NULL REFERENCES "PlaySession"("id") ON DELETE CASCADE,"type" TEXT NOT NULL,"at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),"value" INT NOT NULL DEFAULT 0);
CREATE INDEX "TelemetryEvent_type_at_idx" ON "TelemetryEvent"("type","at");
