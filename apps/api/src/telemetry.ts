/** First-party server telemetry. Only session timing, action steps and counts; never text or credentials. */
import type { Prisma } from "@prisma/client";
import type { PlayerState } from "../../../packages/engine/src/index.ts";
export async function recordActivity(
  tx: Prisma.TransactionClient,
  playerId: string,
  s: PlayerState,
  now: number,
  step?: string,
) {
  if (process.env.ANALYTICS_ENABLED !== "true") return;
  const previous = s.chronicle.sessionId
    ? await tx.playSession.findUnique({ where: { id: s.chronicle.sessionId } })
    : null;
  let session = previous;
  if (!session || now - session.lastAt.getTime() >= 30 * 60000) {
    session = await tx.playSession.create({
      data: { playerId, startedAt: new Date(now), lastAt: new Date(now) },
    });
    s.chronicle.sessionId = session.id;
    await tx.telemetryEvent.create({
      data: {
        playerId,
        sessionId: session.id,
        type: "session-start",
        at: new Date(now),
      },
    });
  }
  await tx.playSession.update({
    where: { id: session.id },
    data: {
      lastAt: new Date(now),
      ...(step ? { lastStep: step } : {}),
      ...(step === "operation-resolve" ? { operations: { increment: 1 } } : {}),
    },
  });
  if (step)
    await tx.telemetryEvent.create({
      data: {
        playerId,
        sessionId: session.id,
        type: step,
        at: new Date(now),
        value:
          step === "ash-cycle"
            ? Math.floor((now - s.chronicle.startedAt) / 1000)
            : 0,
      },
    });
}
