import { connection } from "next/server";

import { getImpact, IMPACT_CACHE_SECONDS } from "@/lib/impact/server";

export async function GET() {
  await connection();
  try {
    const impact = await getImpact();
    return Response.json(impact, {
      headers: { "Cache-Control": `public, s-maxage=${IMPACT_CACHE_SECONDS}, stale-while-revalidate=${IMPACT_CACHE_SECONDS}` },
    });
  } catch {
    console.error("Could not compute impact metrics");
    return Response.json(
      { error: { code: "IMPACT_UNAVAILABLE", message: "Live numbers are unavailable right now" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
