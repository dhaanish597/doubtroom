import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

const reportSchema = z.strictObject({
  roomId: z.string(), messageId: z.string().min(1).max(128), reason: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to report an answer");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Report from DoubtRoom");
    const body = await request.json().catch(() => null);
    if (!(await memberRoom(actor, body?.roomId))) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Enter a reason for the report");
    const { roomId, messageId, reason } = parsed.data;
    const { error } = await adminSupabase().from("reports").insert({
      reporter_id: actor.profile.id, room_id: roomId, message_id: messageId, reason,
    });
    if (error) throw error;
    return apiJson({ ok: true });
  } catch {
    return apiError(500, "REPORT_FAILED", "Could not report the answer");
  }
}
