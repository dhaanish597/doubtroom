import { apiError, apiJson } from "@/lib/api-response";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runRecap } from "@/lib/recap/server";

export const maxDuration = 60;

/** Vercel Cron, daily at 01:30 UTC (07:00 IST). */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return apiError(401, "UNAUTHORIZED", "Not allowed");
  }
  try {
    return apiJson(await runRecap());
  } catch (error) {
    console.error("Recap cron failed", { reason: error instanceof Error ? error.name : "error" });
    return apiError(500, "RECAP_FAILED", "The recap did not run");
  }
}
