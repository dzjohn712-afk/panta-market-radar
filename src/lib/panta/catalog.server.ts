import "server-only";

import { listMarkets } from "./client.server";
import { analyzeCatalogMarkets, selectCatalogCandidates } from "./normalize";
import type { RadarCatalogSnapshot } from "./types";

const CATALOG_LIMIT_PER_PHASE = 50;
const SNAPSHOT_TTL_MS = 150_000;

let cachedSnapshot: RadarCatalogSnapshot | null = null;
let cachedUntil = 0;
let pendingSnapshot: Promise<RadarCatalogSnapshot> | null = null;

async function buildRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const [primary, secondary] = await Promise.all([
    listMarkets({ status: "primary", limit: CATALOG_LIMIT_PER_PHASE }),
    listMarkets({ status: "secondary", limit: CATALOG_LIMIT_PER_PHASE }),
  ]);

  const analysis = analyzeCatalogMarkets([
    ...primary.items,
    ...secondary.items,
  ]);
  const candidates = selectCatalogCandidates(analysis.markets, 20);

  const snapshot: RadarCatalogSnapshot = {
    generatedAt: new Date().toISOString(),
    coverage: {
      primaryFetched: primary.items.length,
      secondaryFetched: secondary.items.length,
      validAfterFiltering: analysis.markets.length,
      candidatesSelected: candidates.length,
    },
    markets: candidates,
  };

  if (process.env.NODE_ENV === "development") {
    snapshot.diagnostics = analysis.diagnostics;
    console.info("[panta-radar] catalog diagnostics", analysis.diagnostics);
  }

  return snapshot;
}

export async function getRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now < cachedUntil) return cachedSnapshot;
  if (pendingSnapshot) return pendingSnapshot;

  pendingSnapshot = buildRadarCatalogSnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cachedUntil = Date.now() + SNAPSHOT_TTL_MS;
      return snapshot;
    })
    .finally(() => {
      pendingSnapshot = null;
    });

  return pendingSnapshot;
}

export const radarSnapshotTtlSeconds = SNAPSHOT_TTL_MS / 1_000;
