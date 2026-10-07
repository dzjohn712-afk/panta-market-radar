import { NextResponse } from "next/server";
import {
  getRadarCatalogSnapshot,
  radarSnapshotTtlSeconds,
} from "@/lib/panta/catalog.server";
import { PantaApiError } from "@/lib/panta/client.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getRadarCatalogSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": `public, s-maxage=${radarSnapshotTtlSeconds}, stale-while-revalidate=30`,
      },
    });
  } catch (error) {
    const isPantaError = error instanceof PantaApiError;
    const retryAfter = isPantaError ? error.retryAfterSeconds : null;

    console.error("Radar catalog load failed", {
      code: isPantaError ? error.code : "UNEXPECTED_ERROR",
      status: isPantaError ? error.status : 500,
    });

    return NextResponse.json(
      {
        error: {
          code: "RADAR_CATALOG_UNAVAILABLE",
          message: "The active market catalog is temporarily unavailable.",
        },
      },
      {
        status: isPantaError && error.status === 500 ? 500 : 503,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      },
    );
  }
}
