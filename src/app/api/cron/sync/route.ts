import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/db";
import { fetchLcboFeedFromSource } from "@/lib/server/ingestion/adapters/lcboAdapter";
import { fetchVivinoSignalsFromSource } from "@/lib/server/ingestion/adapters/vivinoAdapter";
import { persistDeadLetters } from "@/lib/server/ingestion/deadLetterStore";
import { syncLcboCatalog } from "@/lib/server/ingestion/lcboSync";
import { syncVivinoSignals } from "@/lib/server/ingestion/vivinoSync";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

export const runtime = "nodejs";

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function computeSourceStatus(staleMinutes: number, staleThresholdMinutes: number, failedRuns: number): HealthStatus {
  if (failedRuns > 0) return "degraded";
  if (staleMinutes > staleThresholdMinutes * 2) return "unhealthy";
  if (staleMinutes > staleThresholdMinutes) return "degraded";
  return "healthy";
}

function aggregateStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("unhealthy")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

async function currentHealthStatus(): Promise<HealthStatus> {
  const STALE_LCBO_MINUTES = envNumber("INGESTION_LCBO_STALE_MINUTES", 24 * 60);
  const STALE_VIVINO_MINUTES = envNumber("INGESTION_VIVINO_STALE_MINUTES", 24 * 60);
  const MAX_FAILED_SAMPLE_RUNS = envNumber("INGESTION_MAX_FAILED_SAMPLE_RUNS", 1);
  const MAX_DEAD_LETTERS_24H = envNumber("INGESTION_MAX_DEAD_LETTERS_24H", 25);

  const [latestRuns, deadLetterCount24h, latestLcboSuccess, latestVivinoSuccess] = await Promise.all([
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { status: true },
    }),
    prisma.ingestionDeadLetter.count({
      where: {
        receivedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.ingestionRun.findFirst({
      where: { source: "lcbo_catalog", status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    prisma.ingestionRun.findFirst({
      where: { source: "vivino_signals", status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ]);

  const failingRuns = latestRuns.filter((run) => run.status === "failed").length;
  const nowMs = Date.now();
  const lcboStaleMinutes = latestLcboSuccess?.completedAt ? Math.round((nowMs - latestLcboSuccess.completedAt.getTime()) / 60000) : null;
  const vivinoStaleMinutes = latestVivinoSuccess?.completedAt ? Math.round((nowMs - latestVivinoSuccess.completedAt.getTime()) / 60000) : null;

  const lcboStatus =
    lcboStaleMinutes === null
      ? "unhealthy"
      : computeSourceStatus(lcboStaleMinutes, STALE_LCBO_MINUTES, failingRuns >= MAX_FAILED_SAMPLE_RUNS ? 1 : 0);
  const vivinoStatus =
    vivinoStaleMinutes === null
      ? "unhealthy"
      : computeSourceStatus(vivinoStaleMinutes, STALE_VIVINO_MINUTES, failingRuns >= MAX_FAILED_SAMPLE_RUNS ? 1 : 0);
  const deadLetterStatus: HealthStatus =
    deadLetterCount24h > MAX_DEAD_LETTERS_24H * 2 ? "unhealthy" : deadLetterCount24h > MAX_DEAD_LETTERS_24H ? "degraded" : "healthy";

  return aggregateStatus([lcboStatus, vivinoStatus, deadLetterStatus]);
}

async function sendAlertIfNeeded(status: HealthStatus, details: Record<string, unknown>) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl || status === "healthy") return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `[ontario-wine-selector] ingestion health is ${status}`,
      status,
      details,
    }),
  });
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result: {
    catalogResult: Awaited<ReturnType<typeof syncLcboCatalog>> | null;
    signalResult: Awaited<ReturnType<typeof syncVivinoSignals>> | null;
    warnings: string[];
  } = {
    catalogResult: null,
    signalResult: null,
    warnings: [],
  };

  try {
    let catalogFeed: unknown[] | null = null;
    try {
      const liveCatalog = await fetchLcboFeedFromSource();
      if (liveCatalog?.items?.length) catalogFeed = liveCatalog.items;
      if (liveCatalog?.deadLetters?.length) await persistDeadLetters(liveCatalog.deadLetters);
    } catch (error) {
      result.warnings.push(`LCBO adapter failure: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    if (catalogFeed) {
      result.catalogResult = await syncLcboCatalog(catalogFeed);
    } else {
      result.warnings.push("No LCBO feed available; skipped catalog sync.");
    }

    let signalFeed: unknown[] | null = null;
    try {
      const liveSignals = await fetchVivinoSignalsFromSource();
      if (liveSignals?.items?.length) signalFeed = liveSignals.items;
      if (liveSignals?.deadLetters?.length) await persistDeadLetters(liveSignals.deadLetters);
    } catch (error) {
      result.warnings.push(`Vivino adapter failure: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    if (signalFeed) {
      result.signalResult = await syncVivinoSignals(signalFeed);
    } else {
      result.warnings.push("No Vivino feed available; skipped signal sync.");
    }

    const healthStatus = await currentHealthStatus();
    const durationMs = Date.now() - startedAt;
    const payload = {
      status: healthStatus,
      durationMs,
      ...result,
    };
    await sendAlertIfNeeded(healthStatus, payload);

    return NextResponse.json(payload);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const payload = {
      status: "unhealthy" as const,
      durationMs,
      ...result,
      error: error instanceof Error ? error.message : "Unknown cron sync failure",
    };
    await sendAlertIfNeeded("unhealthy", payload);
    return NextResponse.json(payload, { status: 500 });
  }
}

