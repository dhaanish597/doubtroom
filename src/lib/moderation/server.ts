import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { adminSupabase } from "@/lib/supabase/admin";
import { PIN_WINDOW_MS, canAccessAdmin, canAnnounce, canMute } from "./rules";
import type { PinnedAnnouncement, ViewerModeration } from "./types";

type AnnouncementRow = {
  message_id: string | null; title: string | null; body: string | null; urgent: boolean; created_at: string;
  author: { nexconn_user_id: string; display_name: string } | null;
};

/** The signed-in actor may open /admin only while their email is in ADMIN_EMAILS. */
export async function isAdminActor(actor: Actor | null): Promise<boolean> {
  if (!actor || actor.kind !== "user" || actor.profile.role !== "admin") return false;
  const { data, error } = await adminSupabase().from("profiles").select("email").eq("id", actor.profile.id)
    .maybeSingle<{ email: string | null }>();
  if (error) throw error;
  return canAccessAdmin({ kind: actor.kind, role: actor.profile.role, email: data?.email ?? null }, process.env.ADMIN_EMAILS);
}

export async function mutedUntil(roomId: string, profileId: string): Promise<number | null> {
  const { data, error } = await adminSupabase().from("room_members").select("muted_until")
    .eq("room_id", roomId).eq("profile_id", profileId).maybeSingle<{ muted_until: string | null }>();
  if (error) throw error;
  const until = Date.parse(data?.muted_until ?? "");
  return Number.isFinite(until) && until > Date.now() ? until : null;
}

/** Members of a room whose mute has not expired, keyed by Nexconn user ID. */
export async function mutedMembers(roomId: string): Promise<Record<string, number>> {
  const { data, error } = await adminSupabase().from("room_members")
    .select("muted_until,profiles!inner(nexconn_user_id)")
    .eq("room_id", roomId).gt("muted_until", new Date().toISOString())
    .returns<{ muted_until: string; profiles: { nexconn_user_id: string } }[]>();
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.profiles.nexconn_user_id, Date.parse(row.muted_until)]));
}

export async function latestAnnouncement(roomId: string): Promise<PinnedAnnouncement | null> {
  const { data, error } = await adminSupabase().from("announcements")
    .select("message_id,title,body,urgent,created_at,author:profiles(nexconn_user_id,display_name)")
    .eq("room_id", roomId).gt("created_at", new Date(Date.now() - PIN_WINDOW_MS).toISOString())
    .not("message_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle<AnnouncementRow>();
  if (error) throw error;
  if (!data?.message_id) return null;
  return {
    messageId: data.message_id, title: data.title ?? "", body: data.body ?? "", urgent: data.urgent,
    sentTime: Date.parse(data.created_at), authorId: data.author?.nexconn_user_id ?? "",
    authorName: data.author?.display_name ?? "Class rep",
  };
}

/** Room permissions and state for the composer, message menu and pinned card. */
export async function viewerModeration(actor: Actor, room: { id: string; kind: string }): Promise<ViewerModeration> {
  const viewer = { role: actor.profile.role, is_try: actor.profile.is_try };
  const access = { kind: room.kind, isMember: true };
  const [until, pinned] = await Promise.all([
    mutedUntil(room.id, actor.profile.id),
    latestAnnouncement(room.id),
  ]);
  return {
    canAnnounce: canAnnounce(viewer, access),
    canMute: canMute(viewer, access),
    isAdmin: viewer.role === "admin" && !viewer.is_try,
    mutedUntil: until,
    pinned,
  };
}
