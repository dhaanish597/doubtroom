import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import type { OnboardingPlan } from "@/lib/onboarding/plan";
import { profileForAuthUser, publicProfileColumns, type PublicProfile } from "./profile";
import { TRY_COOKIE_NAME, verifyTryCookie } from "./try-cookie";

type ActorProfile = PublicProfile & {
  nexconn_token: string | null;
  pending_onboarding: OnboardingPlan | null;
};

export type Actor = { kind: "user" | "try"; profile: ActorProfile };

const actorColumns = `${publicProfileColumns},nexconn_token,pending_onboarding` as const;

export async function actorForUser(user: User): Promise<Actor> {
  const db = adminSupabase();
  const existing = await db.from("profiles").select(actorColumns).eq("auth_user_id", user.id)
    .maybeSingle<ActorProfile>();
  if (existing.error) throw existing.error;
  if (existing.data) return { kind: "user", profile: existing.data };

  const admins = process.env.ADMIN_EMAILS?.split(",") ?? [];
  const created = await db.from("profiles").upsert(profileForAuthUser(user, admins), {
    onConflict: "auth_user_id",
    ignoreDuplicates: true,
  });
  if (created.error) throw created.error;

  const profile = await db.from("profiles").select(actorColumns).eq("auth_user_id", user.id).single<ActorProfile>();
  if (profile.error) throw profile.error;
  return { kind: "user", profile: profile.data };
}

// Route Handlers and Server Components share Next.js's request-scoped cookies.
export async function getActor(request?: Request): Promise<Actor | null> {
  // Next binds cookie reads and writes to the current request, including API calls.
  void request;
  const supabase = await serverSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user) return actorForUser(user);
  if (error && error.name !== "AuthSessionMissingError" && (!error.status || error.status >= 500)) throw error;

  const store = await cookies();
  const profileId = await verifyTryCookie(store.get(TRY_COOKIE_NAME)?.value);
  if (!profileId) return null;

  const profile = await adminSupabase().from("profiles").select(actorColumns)
    .eq("id", profileId).eq("is_try", true).is("auth_user_id", null).maybeSingle<ActorProfile>();
  if (profile.error) throw profile.error;
  return profile.data ? { kind: "try", profile: profile.data } : null;
}

/** Actor for a chat sender reported by a verified Nexconn webhook. Bots and unknown IDs return null. */
export async function actorForNexconnUser(nexconnUserId: string): Promise<Actor | null> {
  const { data, error } = await adminSupabase().from("profiles").select(actorColumns)
    .eq("nexconn_user_id", nexconnUserId).neq("role", "bot").maybeSingle<ActorProfile>();
  if (error) throw error;
  return data ? { kind: data.is_try ? "try" : "user", profile: data } : null;
}

export function publicProfile(profile: ActorProfile): PublicProfile {
  const { id, nexconn_user_id, display_name, avatar_url, college, dept, year, section, role, lang, is_try, onboarded_at } = profile;
  return { id, nexconn_user_id, display_name, avatar_url, college, dept, year, section, role, lang, is_try, onboarded_at };
}

export const getPageActor = cache(async () => {
  await connection();
  return getActor();
});
