import { connection } from "next/server";
import { z } from "zod";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { MUTE_MINUTES, canMute, canMuteTarget } from "@/lib/moderation/rules";
import { mutedMembers, mutedUntil } from "@/lib/moderation/server";
import type { MuteStatus } from "@/lib/moderation/types";
import { muteGroupMember, unmuteGroupMember } from "@/lib/nexconn/moderation";
import { NexconnError } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

// minutes: 1 to 60 mutes for that long. 0 unmutes.
const muteSchema = z.strictObject({
  roomId: z.string(),
  nexconnUserId: z.string().regex(/^[a-z0-9_]{1,64}$/),
  minutes: z.number().int().min(0).max(MUTE_MINUTES),
});

type Target = { id: string; role: string; room_members: { room_id: string }[] };

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to manage the room");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Manage the room from DoubtRoom");

    const body = await request.json().catch(() => null);
    const room = await memberRoom(actor, body?.roomId);
    if (!room) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    const { role, is_try } = actor.profile;
    if (!canMute({ role, is_try }, { kind: room.kind, isMember: true })) {
      return apiError(403, "FORBIDDEN", "Only your class rep can mute members here");
    }

    const parsed = muteSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Choose a member and a time up to 60 minutes");
    const { nexconnUserId, minutes } = parsed.data;

    const db = adminSupabase();
    const { data: target, error } = await db.from("profiles").select("id,role,room_members(room_id)")
      .eq("nexconn_user_id", nexconnUserId).eq("room_members.room_id", room.id).maybeSingle<Target>();
    if (error) throw error;
    const allowed = target && canMuteTarget(role, {
      role: target.role, isSelf: target.id === actor.profile.id, isMember: target.room_members.length > 0,
    });
    if (!target || !allowed) return apiError(403, "FORBIDDEN", "You can’t mute this member");

    const until = minutes ? new Date(Date.now() + minutes * 60_000) : null;
    if (until) await muteGroupMember(room.id, nexconnUserId, minutes);
    else await unmuteGroupMember(room.id, nexconnUserId);
    const { data: saved, error: saveError } = await db.rpc("set_member_mute", {
      p_room: room.id, p_target: target.id, p_until: until?.toISOString() ?? null, p_actor: actor.profile.id,
    });
    if (saveError) throw saveError;
    if (!saved) return apiError(404, "MEMBER_NOT_FOUND", "This member has left the room");
    return apiJson({ ok: true, mutedUntil: until?.getTime() ?? null });
  } catch (error) {
    console.error("Could not update the mute", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(502, "MUTE_FAILED", "Could not update the mute. Try again.");
  }
}

// The viewer's own mute, plus the room's muted members for reps and admins.
export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to see the room");
    const room = await memberRoom(actor, new URL(request.url).searchParams.get("roomId"));
    if (!room) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    const viewer = { role: actor.profile.role, is_try: actor.profile.is_try };
    const status: MuteStatus = { mutedUntil: await mutedUntil(room.id, actor.profile.id) };
    if (canMute(viewer, { kind: room.kind, isMember: true })) status.members = await mutedMembers(room.id);
    return apiJson(status);
  } catch {
    return apiError(500, "MUTE_STATUS_FAILED", "Could not load the mute status");
  }
}
