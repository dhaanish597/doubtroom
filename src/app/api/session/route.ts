import { connection } from "next/server";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor, publicProfile } from "@/lib/auth/actor";
import { tokenForProfile } from "@/lib/nexconn/profile-token";
import { NexconnError } from "@/lib/nexconn/server";
import { adminSupabase } from "@/lib/supabase/admin";

const refreshSchema = z.union([z.literal("1"), z.null()]);

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to connect to chat");

    const refresh = refreshSchema.safeParse(new URL(request.url).searchParams.get("refresh"));
    if (!refresh.success) return apiError(400, "INVALID_INPUT", "Use refresh=1 to request a new token");
    const appKey = process.env.NEXCONN_APP_KEY;
    if (!appKey) return apiError(503, "NOT_CONFIGURED", "Chat configuration is unavailable");

    const issued = await tokenForProfile(actor.profile, refresh.data === "1");
    const { data: token, error } = await adminSupabase().rpc("record_chat_session", {
      p_profile_id: actor.profile.id,
      p_token: issued,
      p_refresh: refresh.data === "1",
    });
    if (error || typeof token !== "string" || !token) throw error ?? new Error("Missing session token");

    return apiJson({ profile: publicProfile(actor.profile), nexconnUserId: actor.profile.nexconn_user_id, token, appKey });
  } catch (error) {
    if (error instanceof NexconnError) return apiError(502, "CHAT_UNAVAILABLE", "Could not connect to chat");
    console.error("Could not prepare the chat session");
    return apiError(500, "SESSION_FAILED", "Could not prepare your chat session");
  }
}
