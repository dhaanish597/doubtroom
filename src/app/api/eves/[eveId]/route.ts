import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { eveForActor, eveParticipantCount } from "@/lib/eves/server";
import { evePhase } from "@/lib/eves/time";

/** The Eve banner's live headcount. Members of the subject room and admins only. */
export async function GET(request: Request, { params }: { params: Promise<{ eveId: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in first");
    const eve = await eveForActor(actor, (await params).eveId);
    if (!eve) return apiError(404, "EVE_NOT_FOUND", "Exam Eve not found");
    const phase = evePhase(eve, new Date());
    const participantCount = phase === "live" ? await eveParticipantCount(eve.id) : null;
    return apiJson({ eve, phase, participantCount });
  } catch (error) {
    console.error("Could not load the Exam Eve", { reason: error instanceof Error ? error.name : "error" });
    return apiError(500, "EVE_FAILED", "Could not load the Eve");
  }
}
