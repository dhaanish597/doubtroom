import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { canUseRoom } from "@/lib/auth/sandbox";
import { adminSupabase } from "@/lib/supabase/admin";

export async function memberRoom(actor: Actor, roomId: unknown) {
  if (typeof roomId !== "string" || !canUseRoom(actor.kind, roomId)) return null;

  const { data, error } = await adminSupabase().from("room_members")
    .select("rooms!inner(id,title,kind,course_code,courses(title,units))")
    .eq("profile_id", actor.profile.id).eq("room_id", roomId)
    .maybeSingle<{
      rooms: { id: string; title: string; kind: string; course_code: string | null;
        courses: { title: string; units: string[] } | null };
    }>();
  if (error) throw error;
  const room = data?.rooms;
  return room && canUseRoom(actor.kind, room.id, room.kind) ? room : null;
}
