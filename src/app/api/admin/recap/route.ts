import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { isAdminActor } from "@/lib/eves/server";
import { runRecap } from "@/lib/recap/server";
import { requestOrigin } from "@/lib/request-origin";

export const maxDuration = 60;

/** "Run recap now" on /admin. Same function as the cron, so it stays idempotent per room per day. */
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in first");
    if (!isAdminActor(actor)) return apiError(403, "FORBIDDEN", "Only admins can run the recap");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Run the recap from DoubtRoom");
    return apiJson(await runRecap());
  } catch (error) {
    console.error("Manual recap failed", { reason: error instanceof Error ? error.name : "error" });
    return apiError(500, "RECAP_FAILED", "The recap didn’t run. Try again.");
  }
}
