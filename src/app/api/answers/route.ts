import { randomUUID } from "node:crypto";
import { z } from "zod";

import { doubtVerificationMetadata } from "@/lib/answers/rules";
import { canActorVerify, writeGroupMetadata } from "@/lib/answers/server";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

// Records a senior answer the client already sent as RC:ReferenceMsg quoting the doubt.
const bodySchema = z.strictObject({
  roomId: z.string(),
  doubtId: z.uuid(),
  messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  text: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to answer doubts");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Answer from DoubtRoom");

    const body = await request.json().catch(() => null);
    const room = await memberRoom(actor, body?.roomId);
    if (!room) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    if (!(await canActorVerify(actor, { courseCode: room.course_code, isMember: true }))) {
      return apiError(403, "FORBIDDEN", "Only seniors for this subject can post senior answers");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check your answer and try again");
    const { roomId, doubtId, messageId, text } = parsed.data;

    const db = adminSupabase();
    const { data: answerId, error } = await db.rpc("record_mentor_answer", {
      p_answer: randomUUID(), p_doubt: doubtId, p_room: roomId, p_message: messageId,
      p_author: actor.profile.id, p_body: text,
    });
    if (error) throw error;
    if (!answerId) return apiError(404, "DOUBT_NOT_FOUND", "This doubt isn’t on the board yet");

    const doubt = await db.from("doubts").select("message_id,asker:profiles(nexconn_user_id)").eq("id", doubtId)
      .maybeSingle<{ message_id: string | null; asker: { nexconn_user_id: string } | null }>();
    if (doubt.error) throw doubt.error;
    const synced = doubt.data?.message_id
      ? await writeGroupMetadata(roomId, doubt.data.message_id, [doubt.data.asker?.nexconn_user_id ?? "", BOT_IDS.TA],
        doubtVerificationMetadata(true, doubtId), "Senior answer")
      : true;
    return apiJson({ ok: true, answerId, synced });
  } catch {
    console.error("Could not record the senior answer");
    return apiError(500, "ANSWER_FAILED", "Could not save your answer to the board");
  }
}
