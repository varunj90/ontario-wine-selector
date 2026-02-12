import { prisma } from "@/lib/server/db";
import { Prisma } from "@prisma/client";

import type { DeadLetterRecord } from "./validation";

export async function persistDeadLetters(deadLetters: DeadLetterRecord[], ingestionRunId?: string) {
  if (deadLetters.length === 0) return;

  const toJsonValue = (payload: unknown): Prisma.InputJsonValue => {
    try {
      return JSON.parse(JSON.stringify(payload ?? null)) as Prisma.InputJsonValue;
    } catch {
      return {
        unserializablePayload: true,
        payloadType: typeof payload,
      } as Prisma.InputJsonValue;
    }
  };

  await prisma.ingestionDeadLetter.createMany({
    data: deadLetters.map((entry) => ({
      source: entry.source,
      stage: entry.stage,
      reason: entry.reason,
      externalId: entry.externalId,
      payload: toJsonValue(entry.payload),
      ingestionRunId,
    })),
  });
}
