import { connection } from "next/server";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { adminSupabase } from "@/lib/supabase/admin";

const idsSchema = z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)).min(1).max(100);
const demoProfiles = new Set<string>(Object.values(BOT_IDS));

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to look up profiles");

    const raw = new URL(request.url).searchParams.get("ids");
    const parsed = idsSchema.safeParse(raw?.split(","));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Supply up to 100 comma-separated chat user IDs");

    const ids = [...new Set(parsed.data)].filter((id) =>
      actor.kind === "user" || demoProfiles.has(id) || id === actor.profile.nexconn_user_id,
    );
    if (!ids.length) return apiJson({ profiles: {} });

    let query = adminSupabase().from("profiles")
      .select("nexconn_user_id,display_name,avatar_url,role,dept,year").in("nexconn_user_id", ids);
    if (actor.kind === "user") query = query.eq("is_try", false);
    const { data, error } = await query;
    if (error) throw error;
    return apiJson({
      profiles: Object.fromEntries(data.map((profile) => [profile.nexconn_user_id, {
        name: profile.display_name,
        avatar: profile.avatar_url,
        role: profile.role,
        dept: profile.dept,
        year: profile.year,
      }])),
    });
  } catch {
    console.error("Could not look up chat profiles");
    return apiError(500, "PROFILES_FAILED", "Could not look up profiles");
  }
}
