import { connection } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { canDirectMessage } from "@/lib/auth/sandbox";
import { requestOrigin } from "@/lib/request-origin";
import { roomsForActor } from "@/lib/rooms/server";
import { adminSupabase } from "@/lib/supabase/admin";

const chatId = z.string().regex(/^[a-z0-9_]{1,64}$/);
const eventSchema = z.discriminatedUnion("name", [
  z.strictObject({ name: z.enum(["message_sent", "room_opened", "doubt_posted"]), props: z.strictObject({ roomId: chatId }) }),
  z.strictObject({ name: z.enum(["dm_started", "dm_message_sent"]), props: z.strictObject({ peerId: chatId }) }),
]);

async function peerExists(peerId: string) {
  const { count, error } = await adminSupabase().from("profiles").select("id", { count: "exact", head: true })
    .eq("nexconn_user_id", peerId);
  if (error) throw error;
  return Boolean(count);
}

export async function POST(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to record activity");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Submit events from DoubtRoom");

    const body = eventSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError(400, "INVALID_INPUT", "Invalid event");
    const { name, props } = body.data;
    if ("roomId" in props && !(await roomsForActor(actor, props.roomId)).length) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    if ("peerId" in props && (!canDirectMessage(actor.kind, actor.profile.nexconn_user_id, props.peerId) || !(await peerExists(props.peerId)))) {
      return apiError(404, "PEER_NOT_FOUND", "Chat partner not found");
    }

    const { error } = await adminSupabase().from("events").insert({ profile_id: actor.profile.id, name, props });
    if (error) throw error;
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return apiError(500, "EVENT_FAILED", "Could not record room activity");
  }
}
