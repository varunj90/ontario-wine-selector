import { prisma } from "@/lib/server/db";

import type { DeadLetterRecord } from "./validation";

export async function persistDeadLetters(deadLetters: DeadLetterRecord[], ingestionRunId?: string) {
  if (deadLetters.length === 0) return;

  await prisma.ingestionDeadLetter.createMany({
    data: deadLetters.map((entry) => ({
      source: entry.source,
      stage: entry.stage,
      reason: entry.reason,
      externalId: entry.externalId,
      payload: entry.payload,
      ingestionRunId,
    })),
  });
}
