import { prisma } from "@/lib/server/db";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function computeSourceStatus(staleMinutes: number, staleThresholdMinutes: number, failedRuns: number): HealthStatus {
  if (failedRuns > 0) return "degraded";
  if (staleMinutes > staleThresholdMinutes * 2) return "unhealthy";
  if (staleMinutes > staleThresholdMinutes) return "degraded";
  return "healthy";
}

export function aggregateStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("unhealthy")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

export async function currentHealthStatus(): Promise<HealthStatus> {
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

  const failingRuns = latestRuns.filter((run: { status: string }) => run.status === "failed").length;
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
