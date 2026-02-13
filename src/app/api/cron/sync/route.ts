import { NextResponse } from "next/server";

import { fetchLcboFeedFromSource } from "@/lib/server/ingestion/adapters/lcboAdapter";
import { fetchVivinoSignalsFromSource } from "@/lib/server/ingestion/adapters/vivinoAdapter";
import { persistDeadLetters } from "@/lib/server/ingestion/deadLetterStore";
import { currentHealthStatus, type HealthStatus } from "@/lib/server/ingestion/healthStatus";
import { syncLcboCatalog } from "@/lib/server/ingestion/lcboSync";
import { syncVivinoSignals } from "@/lib/server/ingestion/vivinoSync";

export const runtime = "nodejs";

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

