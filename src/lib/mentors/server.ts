import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { isUserOnline } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { createPresenceCache } from "./presence-cache";
import type { MentorSummary } from "./types";

type ProfileRow = {
  nexconn_user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  dept: string | null;
  year: number | null;
};

const presence = createPresenceCache(isUserOnline);
const profileColumns = "nexconn_user_id,display_name,avatar_url,role,dept,year";

async function withPresence(rows: ProfileRow[]): Promise<MentorSummary[]> {
  const status = await presence.onlineStatus(rows.map((row) => row.nexconn_user_id));
  return rows.map((row) => ({
    nexconnId: row.nexconn_user_id,
    name: row.display_name,
    avatar: row.avatar_url,
    role: row.role,
    dept: row.dept,
    year: row.year,
    online: status.get(row.nexconn_user_id) ?? null,
  })).sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || a.name.localeCompare(b.name));
}

export async function mentorsForCourse(actor: Actor, courseCode: string): Promise<MentorSummary[]> {
  const { data, error } = await adminSupabase().from("mentor_subjects")
    .select(`profiles!inner(${profileColumns},is_try)`)
    .eq("course_code", courseCode)
    .in("profiles.role", ["mentor", "admin"])
    .eq("profiles.is_try", false)
    .limit(50)
    .returns<{ profiles: ProfileRow }[]>();
  if (error) throw error;
  const rows = data.map(({ profiles }) => profiles)
    .filter((row) => row.nexconn_user_id !== actor.profile.nexconn_user_id);
  return withPresence(rows);
}

// Used by the DM header when client presence is unavailable.
export async function presenceForUsers(userIds: string[]): Promise<MentorSummary[]> {
  const { data, error } = await adminSupabase().from("profiles").select(profileColumns)
    .in("nexconn_user_id", userIds).eq("is_try", false).returns<ProfileRow[]>();
  if (error) throw error;
  return withPresence(data);
}
