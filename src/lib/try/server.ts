import "server-only";

import { DEMO_ROOM_ID, createTryUserId } from "@/lib/nexconn/ids";
import { issueToken, joinGroup } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { hashIp, judgeName, TRY_ATTEMPT_EVENT, TRY_ATTEMPTS_PER_HOUR } from "./identity";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Records this attempt first, then counts, so parallel requests from one address
 * cannot all slip under the limit.
 */
export async function allowTryAttempt(ip: string, secret: string, now = new Date()): Promise<boolean> {
  const db = adminSupabase();
  const ipHash = hashIp(ip, secret);
  const recorded = await db.from("events").insert({ name: TRY_ATTEMPT_EVENT, props: { ip: ipHash } });
  if (recorded.error) throw recorded.error;
  const { count, error } = await db.from("events").select("id", { count: "exact", head: true })
    .eq("name", TRY_ATTEMPT_EVENT).eq("props->>ip", ipHash)
    .gte("created_at", new Date(now.getTime() - HOUR_MS).toISOString());
  if (error) throw error;
  return (count ?? 0) <= TRY_ATTEMPTS_PER_HOUR;
}

export async function demoRoomReady(): Promise<boolean> {
  const { count, error } = await adminSupabase().from("rooms").select("id", { count: "exact", head: true })
    .eq("id", DEMO_ROOM_ID).eq("kind", "demo");
  if (error) throw error;
  return Boolean(count);
}

export type TryProfile = { id: string; nexconnUserId: string; token: string };

/** Creates the sandbox profile, registers it with Nexconn and joins only the demo room. */
export async function createTryProfile(): Promise<TryProfile> {
  const nexconnUserId = createTryUserId();
  const displayName = judgeName(nexconnUserId);
  const token = await issueToken(nexconnUserId, displayName);
  const db = adminSupabase();

  const { data, error } = await db.from("profiles").insert({
    nexconn_user_id: nexconnUserId,
    display_name: displayName,
    role: "student",
    is_try: true,
    nexconn_token: token,
    token_issued_at: new Date().toISOString(),
  }).select("id").single<{ id: string }>();
  if (error) throw error;

  await joinGroup(DEMO_ROOM_ID, [nexconnUserId]);
  const member = await db.from("room_members").upsert(
    { room_id: DEMO_ROOM_ID, profile_id: data.id },
    { ignoreDuplicates: true },
  );
  if (member.error) throw member.error;
  return { id: data.id, nexconnUserId, token };
}
