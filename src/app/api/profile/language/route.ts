import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { requestOrigin } from "@/lib/request-origin";
import { adminSupabase } from "@/lib/supabase/admin";
import { languages } from "@/lib/ai/languages";

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in first");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Use the profile settings");
    const input = z.strictObject({ lang: z.enum(Object.keys(languages) as [keyof typeof languages, ...(keyof typeof languages)[]]) }).safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError(400, "INVALID_INPUT", "Choose an answer language.");
    const { error } = await adminSupabase().from("profiles").update({ lang: input.data.lang }).eq("id", actor.profile.id);
    if (error) throw error;
    return apiJson({ lang: input.data.lang });
  } catch {
    return apiError(500, "SAVE_FAILED", "Couldn’t save your answer language.");
  }
}
