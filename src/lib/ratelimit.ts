import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { adminSupabase } from "@/lib/supabase/admin";

function limit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : fallback;
}

export async function reserveTaRequest(actor: Actor, input: {
  roomId: string; messageId: string; doubtId?: string; text: string; unit?: string;
  imageUrl?: string; lang: string; qHash: string | null;
}): Promise<"allowed" | "daily" | "room" | "duplicate"> {
  const { data, error } = await adminSupabase().rpc("reserve_ta_request", {
    p_room: input.roomId, p_message: input.messageId, p_doubt: input.doubtId ?? null,
    p_profile: actor.profile.id, p_text: input.text, p_unit: input.unit ?? null,
    p_image: input.imageUrl ?? null, p_lang: input.lang, p_hash: input.qHash,
    p_user_limit: actor.kind === "try" ? limit(process.env.AI_DAILY_LIMIT_TRY, 5) : limit(process.env.AI_DAILY_LIMIT_PER_USER, 25),
    p_global_limit: limit(process.env.AI_DAILY_LIMIT_GLOBAL, 200),
  });
  if (error) throw error;
  if (data === "allowed" || data === "daily" || data === "room" || data === "duplicate") return data;
  throw new Error("Unexpected TA quota response");
}
