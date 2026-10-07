import "server-only";

import { listMarkets } from "./client.server";
import { discoverActiveCatalog } from "./discovery";
import { selectCatalogCandidates } from "./normalize";
import type { RadarCatalogSnapshot } from "./types";

const CATALOG_LIMIT_PER_PHASE = 50;
const SNAPSHOT_TTL_MS = 150_000;

let cachedSnapshot: RadarCatalogSnapshot | null = null;
let cachedUntil = 0;
let pendingSnapshot: Promise<RadarCatalogSnapshot> | null = null;

async function buildRadarCatalogSnapshot(): Promise<RadarCatalogSnapshot> {
  const discovery = await discoverActiveCatalog((status, cursor) =>
    listMarkets({ status, limit: CATALOG_LIMIT_PER_PHASE, cursor }),
  );
  const candidates = selectCatalogCandidates(discovery.validMarkets, 20);

  const snapshot: RadarCatalogSnapshot = {
    generatedAt: new Date().toISOString(),
    coverage: {
      primaryPagesFetched: discovery.primaryPagesFetched,
      secondaryPagesFetched: discovery.secondaryPagesFetched,
      primaryFetched: discovery.primaryRows.length,
      secondaryFetched: discovery.secondaryRows.length,
      validAfterFiltering: discovery.validMarkets.length,
      candidatesSelected: candidates.length,
    },
    markets: candidates,
  };

  if (process.env.NODE_ENV === "development") {
    snapshot.diagnostics = discovery.diagnostics;
    console.info(
      "[panta-radar] catalog diagnostics (rejection counters overlap)",
      discovery.diagnostics,
    );
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
