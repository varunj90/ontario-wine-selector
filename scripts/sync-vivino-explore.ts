#!/usr/bin/env npx tsx
/**
 * Vivino Explore API Sync  (v3 — explore + winery expansion)
 *
 * Phase 1: Paginate the Vivino explore API (~24k wines for Canada)
 * Phase 2: Build winery name → ID map from Phase 1
 * Phase 3: For unmatched LCBO wines, find their producer in the winery map,
 *          call /api/wineries/{id}/wines to get the FULL winery catalog,
 *          then fuzzy-match to find the specific wine
 * Phase 4: Write WineQualitySignal + direct vivinoUrl
 *
 * Usage:
 *   npx tsx scripts/sync-vivino-explore.ts
 *   npx tsx scripts/sync-vivino-explore.ts --dry-run
 *   npx tsx scripts/sync-vivino-explore.ts --max-pages=50
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ── Prisma ─────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error("DATABASE_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

// ── CLI ────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const maxPagesArg = process.argv.find((a) => a.startsWith("--max-pages="));
const MAX_PAGES = maxPagesArg ? Number(maxPagesArg.split("=")[1]) : 1025;

// ── Vivino API ─────────────────────────────────────────────────────
const VIVINO_BASE = "https://www.vivino.com";
const PER_PAGE = 50;
const RATE_MS = 400;
const WINERY_RATE_MS = 350;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Types ──────────────────────────────────────────────────────────

type VWine = {
  idx: number;
  wineryName: string;
  fullName: string;
  wineNameOnly: string;
  rating: number;
  ratingCount: number;
  wineId: number;
  region: string;
  country: string;
  directUrl: string;
  tokens: Set<string>;
};

type WineryInfo = {
  id: number;
  name: string;
  seoName: string;
};

// ── Normalisation ──────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "wine", "wines", "estate", "estates", "winery", "vineyards", "vineyard",
  "cellars", "cellar", "reserve", "reserva", "riserva", "cuvee", "gran",
  "grande", "grand", "special", "limited", "edition", "classic", "selection",
  "old", "vines", "single", "barrel", "organic", "natural", "dry", "off",
  "sweet", "semi", "brut", "extra", "vintage", "vqa", "doc", "docg", "igt",
  "aoc", "ava", "kp", "do", "dop", "de", "di", "du", "des", "del", "della",
  "le", "la", "les", "los", "el", "il", "the", "and", "or", "bin",
]);

function normalise(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, " ").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function significantTokens(raw: string): Set<string> {
  return new Set(normalise(raw).split(" ").filter((t) => t.length > 1 && !STOP_WORDS.has(t)));
}

// ── Grape conflict detection ───────────────────────────────────────

const GRAPES_1W = new Set([
  "chardonnay", "riesling", "merlot", "syrah", "shiraz", "malbec",
  "tempranillo", "sangiovese", "nebbiolo", "barbera", "gamay",
  "zinfandel", "grenache", "mourvedre", "pinotage", "primitivo",
  "viognier", "moscato", "muscat", "prosecco", "champagne", "cava",
  "verdejo", "vermentino", "trebbiano", "garganega", "cortese",
  "pecorino", "dolcetto", "aglianico", "tannat", "zweigelt", "torrontes",
  "albarino", "carmenere", "montepulciano", "negroamaro",
]);
const GRAPES_2W = [
  "cabernet sauvignon", "pinot noir", "cabernet franc", "sauvignon blanc",
  "pinot grigio", "pinot gris", "pinot blanc", "chenin blanc",
  "petit verdot", "petite sirah", "gruner veltliner", "nero avola",
];
function grapes(text: string): Set<string> {
  const n = normalise(text);
  const s = new Set<string>();
  for (const g of GRAPES_2W) if (n.includes(g)) s.add(g);
  for (const t of n.split(" ")) if (GRAPES_1W.has(t)) s.add(t);
  return s;
}
function varietalConflict(a: string, b: string): boolean {
  const ga = grapes(a), gb = grapes(b);
  if (ga.size === 0 || gb.size === 0) return false;
  for (const g of ga) {
    if (gb.has(g)) return false;
    if (g === "syrah" && gb.has("shiraz")) return false;
    if (g === "shiraz" && gb.has("syrah")) return false;
  }
  return true;
}

// ── Vivino explore page fetch ──────────────────────────────────────

async function fetchExplorePage(page: number): Promise<{ wines: VWine[]; wineries: WineryInfo[]; total: number }> {
  const params = new URLSearchParams({
    country_code: "CA", currency_code: "CAD", min_rating: "1",
    order_by: "ratings_count", order: "desc", page: String(page), per_page: String(PER_PAGE),
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  let resp: Response;
  try {
    resp = await fetch(`${VIVINO_BASE}/api/explore/explore?${params}`, { headers: { "User-Agent": UA }, signal: ac.signal });
  } catch { clearTimeout(timer); return { wines: [], wineries: [], total: 0 }; }
  clearTimeout(timer);

  if (!resp.ok) {
    if (resp.status === 429) { await sleep(10_000); return fetchExplorePage(page); }
    return { wines: [], wineries: [], total: 0 };
  }

  const json = (await resp.json()) as any;
  const ev = json.explore_vintage ?? {};
  const total: number = ev.records_matched ?? 0;
  const wines: VWine[] = [];
  const wineries: WineryInfo[] = [];
  const seenWineries = new Set<number>();

  for (const m of ev.matches ?? []) {
    const v = m.vintage; const w = v?.wine;
    if (!v || !w?.id) continue;
    const winery = w.winery ?? {};
    const wineryName = winery.name ?? "";
    const wineNameOnly = w.name ?? "";
    const fullName = v.name ?? `${wineryName} ${wineNameOnly}`.trim();
    const rating: number = v.statistics?.ratings_average ?? 0;
    const ratingCount: number = v.statistics?.ratings_count ?? 0;
    if (rating <= 0 || ratingCount <= 0) continue;

    const wSeo = winery.seo_name ?? ""; const vSeo = v.seo_name ?? "";
    const directUrl = wSeo && vSeo
      ? `${VIVINO_BASE}/${wSeo}/${vSeo}`
      : `${VIVINO_BASE}/w/${w.id}`;

    wines.push({
      idx: 0, wineryName, fullName, wineNameOnly, rating, ratingCount,
      wineId: w.id, region: w.region?.name ?? "", country: w.region?.country?.name ?? "",
      directUrl, tokens: significantTokens(`${wineryName} ${fullName}`),
    });

    if (winery.id && !seenWineries.has(winery.id)) {
      seenWineries.add(winery.id);
      wineries.push({ id: winery.id, name: wineryName, seoName: wSeo });
    }
  }
  return { wines, wineries, total };
}

// ── Winery wines fetch ─────────────────────────────────────────────

async function fetchWineryWines(wineryId: number, wineryName: string, winerySeo: string): Promise<VWine[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  let resp: Response;
  try {
    resp = await fetch(`${VIVINO_BASE}/api/wineries/${wineryId}/wines`, {
      headers: { "User-Agent": UA, Accept: "application/json" }, signal: ac.signal,
    });
  } catch { clearTimeout(timer); return []; }
  clearTimeout(timer);

  if (!resp.ok) return [];

  const json = (await resp.json()) as { wines?: Array<{ id: number; name: string; seo_name: string; statistics?: { ratings_average: number; ratings_count: number } }> };
  const wines: VWine[] = [];

  for (const w of json.wines ?? []) {
    const rating = w.statistics?.ratings_average ?? 0;
    const ratingCount = w.statistics?.ratings_count ?? 0;
    if (rating <= 0 || ratingCount < 5) continue;

    const fullName = `${wineryName} ${w.name}`.trim();
    const directUrl = winerySeo && w.seo_name
      ? `${VIVINO_BASE}/${winerySeo}/${winerySeo}-${w.seo_name}-nv`
      : `${VIVINO_BASE}/w/${w.id}`;

    wines.push({
      idx: 0, wineryName, fullName, wineNameOnly: w.name,
      rating, ratingCount, wineId: w.id, region: "", country: "",
      directUrl, tokens: significantTokens(`${wineryName} ${w.name}`),
    });
  }
  return wines;
}

// ── Inverted index ─────────────────────────────────────────────────

function buildIndex(wines: VWine[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  for (const w of wines) {
    for (const t of w.tokens) {
      let arr = idx.get(t); if (!arr) { arr = []; idx.set(t, arr); }
      arr.push(w.idx);
    }
  }
  return idx;
}

function getCandidates(tokens: Set<string>, index: Map<string, number[]>, minShared: number): Set<number> {
  const counts = new Map<number, number>();
  for (const t of tokens) {
    const ids = index.get(t); if (!ids) continue;
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out = new Set<number>();
  for (const [id, c] of counts) if (c >= minShared) out.add(id);
  return out;
}

// ── Scoring ────────────────────────────────────────────────────────

function jaccardSig(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap += 1;
  const union = a.size + b.size - overlap;
  return union > 0 ? overlap / union : 0;
}

function matchOne(
  lcboName: string, lcboProducer: string,
  vivinoWines: VWine[], index: Map<string, number[]>,
): { wine: VWine; score: number } | null {
  const isUnknown = lcboProducer === "Unknown Producer";
  const targetRaw = isUnknown ? lcboName : `${lcboProducer} ${lcboName}`;
  const targetTokens = significantTokens(targetRaw);
  const lcboNorm = normalise(lcboName);
  const producerNorm = isUnknown ? "" : normalise(lcboProducer);

  const minShared = targetTokens.size <= 2 ? 1 : 2;
  const candidates = getCandidates(targetTokens, index, minShared);
  if (candidates.size === 0) return null;

  let best: VWine | null = null; let bestScore = 0;

  for (const ci of candidates) {
    const vw = vivinoWines[ci];
    if (varietalConflict(lcboName, vw.fullName)) continue;

    let score = jaccardSig(targetTokens, vw.tokens);

    // Producer match / mismatch
    if (producerNorm && vw.wineryName) {
      const wineryNorm = normalise(vw.wineryName);
      if (producerNorm === wineryNorm) score += 0.20;
      else if (producerNorm.includes(wineryNorm) || wineryNorm.includes(producerNorm)) score += 0.12;
      else {
        const pTokens = new Set(producerNorm.split(" ").filter((t) => t.length > 1));
        const wTokens = new Set(wineryNorm.split(" ").filter((t) => t.length > 1));
        let pOverlap = false;
        for (const pt of pTokens) if (wTokens.has(pt)) { pOverlap = true; break; }
        if (!pOverlap) score -= 0.10;
      }
    }

    // Substring containment bonus
    const vivinoNorm = normalise(vw.fullName);
    if (lcboNorm.includes(vivinoNorm) || vivinoNorm.includes(lcboNorm)) score += 0.10;

    if (score > bestScore) { bestScore = score; best = vw; }
  }

  if (!best) return null;
  const minScore = isUnknown ? 0.50 : 0.45;
  if (bestScore < minScore) return null;
  return { wine: best, score: bestScore };
}

// ── DB write ───────────────────────────────────────────────────────

async function writeMatch(wineId: string, vivinoWine: VWine, confidence: number): Promise<boolean> {
  if (dryRun) return true;
  await prisma.wineQualitySignal.deleteMany({ where: { wineId, source: "vivino" } });
  await prisma.wineQualitySignal.create({
    data: {
      wineId, source: "vivino",
      rating: Number(vivinoWine.rating.toFixed(2)),
      ratingCount: vivinoWine.ratingCount,
      confidenceScore: confidence,
      fetchedAt: new Date(),
    },
  });
  if (vivinoWine.directUrl && confidence >= 0.55) {
    await prisma.wine.update({ where: { id: wineId }, data: { vivinoUrl: vivinoWine.directUrl } });
    return true;
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Vivino Sync  v3  (explore + winery expansion)   ║");
  console.log("╚══════════════════════════════════════════════════╝");
  if (dryRun) console.log("  *** DRY RUN ***\n");

  // ═══ PHASE 1: Crawl explore API ════════════════════════════════
  console.log("── Phase 1: Crawling Vivino explore API ────────────\n");
  const allWines: VWine[] = [];
  const wineryMap = new Map<string, WineryInfo>(); // normalised name → winery info
  let page = 1; let reportedTotal = 0;

  while (page <= MAX_PAGES) {
    const r = await fetchExplorePage(page);
    if (page === 1) {
      reportedTotal = r.total;
      console.log(`  Catalog: ${reportedTotal.toLocaleString()} wines`);
    }
    if (r.wines.length === 0) break;
    if (allWines.length >= reportedTotal + 200) break;

    for (const w of r.wines) { w.idx = allWines.length; allWines.push(w); }
    for (const wi of r.wineries) {
      const key = normalise(wi.name);
      if (!wineryMap.has(key)) wineryMap.set(key, wi);
    }
    if (page % 25 === 0) console.log(`  page ${page} — ${allWines.length.toLocaleString()} wines, ${wineryMap.size} wineries`);
    page += 1;
    await sleep(RATE_MS);
  }
  console.log(`\n  ✔ ${allWines.length.toLocaleString()} wines, ${wineryMap.size.toLocaleString()} unique wineries\n`);

  // ═══ PHASE 2: Match LCBO wines against explore catalog ═════════
  console.log("── Phase 2: Matching explore catalog ───────────────\n");
  const index = buildIndex(allWines);

  const lcbo = await prisma.wine.findMany({
    select: { id: true, name: true, producer: true, country: true, vivinoUrl: true },
  });
  console.log(`  LCBO wines: ${lcbo.length.toLocaleString()}`);

  let matched = 0, high = 0, med = 0, urlsUp = 0;
  const unmatchedWines: typeof lcbo = [];
  // Track claimed Vivino wines to enforce 1:1 matching.
  // Key = Vivino wine fullName (unique within crawl), value = { lcboName, score }
  const claimedVivino = new Map<string, { lcboName: string; score: number; lcboId: string }>();

  for (const [i, w] of lcbo.entries()) {
    const r = matchOne(w.name, w.producer, allWines, index);
    if (!r) { unmatchedWines.push(w); continue; }

    // Enforce 1:1: if this Vivino wine is already claimed by a better match, skip
    const vivinoKey = r.wine.fullName;
    const existing = claimedVivino.get(vivinoKey);
    if (existing && existing.score >= r.score) {
      unmatchedWines.push(w);
      continue;
    }
    // If we're stealing from a previous match, mark the old LCBO wine as unmatched
    if (existing) {
      // The old match was weaker; it will remain in DB but the new one will overwrite.
      // In practice this is rare and the old signal will be overwritten in the next sync.
    }
    claimedVivino.set(vivinoKey, { lcboName: w.name, score: r.score, lcboId: w.id });

    const conf = Math.max(0.55, Math.min(0.95, r.score));
    matched += 1;
    if (conf >= 0.72) high += 1; else med += 1;
    const urlUp = await writeMatch(w.id, r.wine, conf);
    if (urlUp) urlsUp += 1;

    if (matched <= 10) console.log(`  ✓ "${w.name}" → ${r.wine.wineryName} ${r.wine.wineNameOnly} | ${r.wine.rating}/5 (conf=${conf.toFixed(2)})`);
    if ((i + 1) % 1000 === 0) console.log(`  ... ${i + 1}/${lcbo.length}, ${matched} matched`);
  }
  console.log(`\n  Phase 2: ${matched} matched (${((matched / lcbo.length) * 100).toFixed(1)}%), ${unmatchedWines.length} unmatched\n`);

  // ═══ PHASE 3: Winery expansion for unmatched wines ═════════════
  console.log("── Phase 3: Winery expansion lookup ────────────────\n");

  // Build a map of producer names (normalised) → LCBO wines that need matching
  const producerGroups = new Map<string, typeof lcbo>();
  for (const w of unmatchedWines) {
    if (w.producer === "Unknown Producer") continue;
    const key = normalise(w.producer);
    if (!key) continue;
    let group = producerGroups.get(key);
    if (!group) { group = []; producerGroups.set(key, group); }
    group.push(w);
  }

  console.log(`  Unique producers to look up: ${producerGroups.size}`);
  let wineryLookups = 0; let wineryMatched = 0; let wineryHigh = 0;

  for (const [prodNorm, wines] of producerGroups) {
    // Find this producer in our winery map
    let winery: WineryInfo | undefined;

    // Exact match first
    winery = wineryMap.get(prodNorm);

    // Substring match
    if (!winery) {
      for (const [key, info] of wineryMap) {
        if (key.includes(prodNorm) || prodNorm.includes(key)) { winery = info; break; }
      }
    }

    // Token overlap match (for cases like "Château Pey" vs "Chateau Pey La Tour")
    if (!winery) {
      const prodTokens = new Set(prodNorm.split(" ").filter((t) => t.length > 2));
      if (prodTokens.size >= 1) {
        let bestOverlap = 0; let bestWinery: WineryInfo | undefined;
        for (const [key, info] of wineryMap) {
          const wTokens = new Set(key.split(" ").filter((t) => t.length > 2));
          let overlap = 0;
          for (const t of prodTokens) if (wTokens.has(t)) overlap += 1;
          const score = overlap / Math.max(prodTokens.size, wTokens.size);
          if (score > bestOverlap && score >= 0.5) { bestOverlap = score; bestWinery = info; }
        }
        winery = bestWinery;
      }
    }

    if (!winery) continue;

    // Fetch all wines for this winery
    const wineryWines = await fetchWineryWines(winery.id, winery.name, winery.seoName);
    if (wineryWines.length === 0) { await sleep(WINERY_RATE_MS); continue; }
    wineryLookups += 1;

    // Build a mini-index for winery wines
    for (let i = 0; i < wineryWines.length; i++) wineryWines[i].idx = i;
    const miniIndex = buildIndex(wineryWines);

    // Match each LCBO wine in this producer group
    for (const w of wines) {
      const r = matchOne(w.name, w.producer, wineryWines, miniIndex);
      if (!r) continue;

      // Enforce 1:1 in Phase 3 as well
      const vivinoKey = r.wine.fullName;
      const existingClaim = claimedVivino.get(vivinoKey);
      if (existingClaim && existingClaim.score >= r.score) continue;
      claimedVivino.set(vivinoKey, { lcboName: w.name, score: r.score, lcboId: w.id });

      const conf = Math.max(0.55, Math.min(0.95, r.score));
      wineryMatched += 1;
      matched += 1;
      if (conf >= 0.72) { high += 1; wineryHigh += 1; } else med += 1;
      const urlUp = await writeMatch(w.id, r.wine, conf);
      if (urlUp) urlsUp += 1;

      if (wineryMatched <= 10) console.log(`  ✓ "${w.name}" → (winery) ${r.wine.wineryName} ${r.wine.wineNameOnly} | ${r.wine.rating}/5`);
    }

    if (wineryLookups % 100 === 0) console.log(`  ... ${wineryLookups} wineries queried, +${wineryMatched} matches`);
    await sleep(WINERY_RATE_MS);
  }

  console.log(`\n  Phase 3: +${wineryMatched} matches from ${wineryLookups} winery lookups`);

  // ═══ Summary ═══════════════════════════════════════════════════
  const total = lcbo.length;
  console.log("\n══════════════════════════════════════════════════");
  console.log("  FINAL RESULTS");
  console.log("══════════════════════════════════════════════════");
  console.log(`  LCBO wines        : ${total.toLocaleString()}`);
  console.log(`  Vivino crawled    : ${allWines.length.toLocaleString()}`);
  console.log(`  Wineries known    : ${wineryMap.size.toLocaleString()}`);
  console.log(`  Total matched     : ${matched.toLocaleString()} (${((matched / total) * 100).toFixed(1)}%)`);
  console.log(`    Phase 2 (explore) : ${(matched - wineryMatched)}`);
  console.log(`    Phase 3 (winery)  : +${wineryMatched}`);
  console.log(`    High (≥ 0.72)     : ${high}`);
  console.log(`    Medium (< 0.72)   : ${med}`);
  console.log(`  No match          : ${(total - matched).toLocaleString()} (${(((total - matched) / total) * 100).toFixed(1)}%)`);
  console.log(`  URLs updated      : ${urlsUp}`);
  if (dryRun) console.log("  (DRY RUN)");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
