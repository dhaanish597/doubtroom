import { after, connection } from "next/server";
import { z } from "zod";

import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { canDirectMessage } from "@/lib/auth/sandbox";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { NexconnError, sendDirectText } from "@/lib/nexconn/server";
import { requestOrigin } from "@/lib/request-origin";
import { adminSupabase } from "@/lib/supabase/admin";
import { demoMentorReply } from "@/lib/try/mentor-reply";

export const maxDuration = 15;

const REPLY_DELAY_MS = 3_000;
const PING_WINDOW_MS = 60_000;
const PINGS_PER_WINDOW = 4;
const PING_EVENT = "mentor_ping";

const bodySchema = z.strictObject({ text: z.string().trim().min(1).max(2000) });

/** Counts recent pings (no message text is stored) so one judge cannot flood the demo mentor. */
async function allowPing(profileId: string) {
  const db = adminSupabase();
  const { count, error } = await db.from("events").select("id", { count: "exact", head: true })
    .eq("name", PING_EVENT).eq("profile_id", profileId)
    .gte("created_at", new Date(Date.now() - PING_WINDOW_MS).toISOString());
  if (error) throw error;
  if ((count ?? 0) >= PINGS_PER_WINDOW) return false;
  const recorded = await db.from("events").insert({ profile_id: profileId, name: PING_EVENT });
  if (recorded.error) throw recorded.error;
  return true;
}

export async function POST(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Start the demo first");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Message from DoubtRoom");
    if (actor.kind !== "try" || !canDirectMessage(actor.kind, actor.profile.nexconn_user_id, BOT_IDS.DEMO_MENTOR)) {
      return apiError(403, "FORBIDDEN", "Only demo visitors can ping the demo senior");
    }
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError(400, "INVALID_INPUT", "Write a message first");
    if (!(await allowPing(actor.profile.id))) return apiError(429, "RATE_LIMITED", "Arun is replying. Give him a moment.");

    const reply = demoMentorReply(body.data.text);
    const recipient = actor.profile.nexconn_user_id;
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, REPLY_DELAY_MS));
      try {
        await sendDirectText(BOT_IDS.DEMO_MENTOR, recipient, reply);
      } catch (error) {
        console.error("Demo mentor reply failed", { code: error instanceof NexconnError ? error.errorCode : undefined });
      }
    });
    return apiJson({ accepted: true }, 202);
  } catch {
    console.error("Could not accept the demo mentor ping");
    return apiError(500, "PING_FAILED", "Could not reach the demo senior");
  }
}
