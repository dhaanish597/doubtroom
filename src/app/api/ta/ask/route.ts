import { after } from "next/server";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { NexconnError } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { acceptTaRequest } from "@/lib/ta/accept";

export const maxDuration = 45;

// Browser relay: the sender's client calls this right after sending. The Nexconn message:send
// webhook (/api/nexconn/webhook) triggers the same work; whichever arrives second is a duplicate.
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to ask the TA");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Ask from DoubtRoom");
    const body = await request.json().catch(() => null);
    const accepted = await acceptTaRequest(actor, body);
    if (!accepted.ok) return apiError(accepted.status, accepted.code, accepted.message);
    if (!accepted.duplicate) after(accepted.run);
    return apiJson({ accepted: true }, 202);
  } catch (error) {
    console.error("Could not accept TA request", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(500, "TA_FAILED", "Could not ask the TA");
  }
}
