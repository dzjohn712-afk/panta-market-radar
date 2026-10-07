import "server-only";
import process from "node:process";
import { unstable_cache } from "next/cache";
import { getMarket, getMarketTrades, listMarkets } from "./client.server";
import { loadRadarSnapshot } from "./radar-loader";
import { singleFlight } from "./coordination";
import { upstreamNamespace } from "./cache-namespace";

const SNAPSHOT_TTL_MS = 150_000;
const identity = ["panta-radar-v31-no-fixtures", process.env.NODE_ENV ?? "unknown",
  upstreamNamespace(process.env.PANTA_API_BASE_URL)];
// node:process is the same object across the page/route VM contexts.
// This guard coordinates one Node process, not multiple deployment instances.
const radarProcess = process as typeof process & {
  pantaRadarFlights?: Map<string, Promise<unknown>>;
};
const flights = radarProcess.pantaRadarFlights ??= new Map();
const flightKey = JSON.stringify(identity);

async function buildRadarSnapshot() {
  return singleFlight(flights, flightKey, () => {
    const development = process.env.NODE_ENV === "development";
    return loadRadarSnapshot({listMarkets, getMarket, getMarketTrades}, development);
  });
}

// Bound callback text is stable across differently minified route/page bundles.
export const getRadarSnapshot = unstable_cache(
  buildRadarSnapshot.bind(null), identity, { revalidate: SNAPSHOT_TTL_MS / 1_000 },
);
