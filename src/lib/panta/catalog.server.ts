import "server-only";

import { listMarkets } from "./client.server";
import { normalizeAndDeduplicateMarkets, selectCatalogCandidates } from "./normalize";
import type { RadarCatalogSnapshot } from "./types";

const CATALOG_LIMIT_PER_PHASE = 20;
const SNAPSHOT_TTL_MS = 150_000;

let cachedSnapshot: RadarCatalogSnapshot | null = null;
let cachedUntil = 0;
let pendingSnapshot: Promise<RadarCatalogSnapshot> | null = null;

async function buildRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const [primary, secondary] = await Promise.all([
    listMarkets({ status: "primary", limit: CATALOG_LIMIT_PER_PHASE }),
    listMarkets({ status: "secondary", limit: CATALOG_LIMIT_PER_PHASE }),
  ]);

  const validMarkets = normalizeAndDeduplicateMarkets([
    ...primary.items,
    ...secondary.items,
  ]);
  const candidates = selectCatalogCandidates(validMarkets, 20);

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      primaryFetched: primary.items.length,
      secondaryFetched: secondary.items.length,
      validAfterFiltering: validMarkets.length,
      candidatesSelected: candidates.length,
    },
    markets: candidates,
  };
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
