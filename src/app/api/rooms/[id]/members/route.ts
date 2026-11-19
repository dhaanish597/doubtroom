import { connection } from "next/server";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { roomMemberIds } from "@/lib/rooms/members";
import { roomsForActor } from "@/lib/rooms/server";
import type { RoomMember } from "@/lib/rooms/types";
import { adminSupabase } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to see room members");
    const { id } = await params;
    if (!/^[a-z0-9_]{1,64}$/.test(id) || !(await roomsForActor(actor, id)).length) {
      return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    }

    const ids = (await roomMemberIds(id)).filter((userId) => userId !== BOT_IDS.TA && userId !== actor.profile.nexconn_user_id);
    const members: RoomMember[] = [{ userId: BOT_IDS.TA, name: "TA (DoubtRoom TA)" }];
    const db = adminSupabase();
    for (let start = 0; start < ids.length; start += 100) {
      let query = db.from("profiles").select("nexconn_user_id,display_name").in("nexconn_user_id", ids.slice(start, start + 100));
      if (actor.kind === "try") query = query.or("is_try.eq.true,nexconn_user_id.in.(demo_mentor,demo_priya)");
      const { data, error } = await query;
      if (error) throw error;
      members.push(...data.map((profile) => ({ userId: profile.nexconn_user_id, name: profile.display_name })));
    }
    return apiJson({ members: [members[0], ...members.slice(1).sort((a, b) => a.name.localeCompare(b.name))] });
  } catch {
    return apiError(502, "MEMBERS_UNAVAILABLE", "Could not load room members");
  }
}
