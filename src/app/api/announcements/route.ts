import { z } from "zod";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { ANNOUNCE_BODY_MAX, ANNOUNCE_TITLE_MAX, canAnnounce } from "@/lib/moderation/rules";
import { mutedUntil } from "@/lib/moderation/server";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

const announcementSchema = z.strictObject({
  roomId: z.string(),
  messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  title: z.string().trim().min(1).max(ANNOUNCE_TITLE_MAX),
  body: z.string().trim().min(1).max(ANNOUNCE_BODY_MAX),
  urgent: z.boolean().optional(),
});

// Records an announcement the rep already sent with the client SDK. Retries are idempotent.
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to post announcements");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Post from DoubtRoom");

    const body = await request.json().catch(() => null);
    const room = await memberRoom(actor, body?.roomId);
    if (!room) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    if (!canAnnounce({ role: actor.profile.role, is_try: actor.profile.is_try }, { kind: room.kind, isMember: true })) {
      return apiError(403, "FORBIDDEN", "Only class reps can post announcements here");
    }
    if (await mutedUntil(room.id, actor.profile.id)) return apiError(403, "MUTED", "You are muted in this room");

    const parsed = announcementSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Add a title and a message");
    const { messageId, title, body: text, urgent } = parsed.data;
    const { error } = await adminSupabase().rpc("record_announcement", {
      p_room: room.id, p_author: actor.profile.id, p_message: messageId, p_title: title, p_body: text,
      p_urgent: urgent ?? false,
    });
    if (error) throw error;
    return apiJson({ ok: true });
  } catch {
    console.error("Could not record the announcement");
    return apiError(500, "ANNOUNCEMENT_FAILED", "Could not save the announcement");
  }
}
