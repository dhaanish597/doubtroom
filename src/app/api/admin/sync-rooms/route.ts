import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { isAdminActor } from "@/lib/moderation/server";
import { NexconnError } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { syncCatalogRooms } from "@/lib/rooms/sync";

export const maxDuration = 60;
/** Stop starting new work with headroom before maxDuration so the response still goes out. */
const TIME_BUDGET_MS = 45_000;

/** Admin only, no body. Returns { created, joined, deferred }; run again while deferred > 0. */
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in as an admin");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Sync rooms from DoubtRoom");
    if (!(await isAdminActor(actor))) return apiError(403, "FORBIDDEN", "Admins only");
    return apiJson(await syncCatalogRooms({ deadline: Date.now() + TIME_BUDGET_MS }));
  } catch (error) {
    console.error("Could not sync rooms", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(502, "SYNC_FAILED", "Could not sync rooms. Try again.");
  }
}
