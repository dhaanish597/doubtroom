import { z } from "zod";

import { loadAnswer, writeGroupMetadata } from "@/lib/answers/server";
import type { VoteResult } from "@/lib/answers/types";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

const answerId = z.uuid();
// An explicit state keeps retries and double taps idempotent. No body toggles.
const bodySchema = z.strictObject({ voted: z.boolean().optional() });
const voteRow = z.object({ total: z.number().int().nonnegative(), voted: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to upvote");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Upvote from DoubtRoom");

    const id = answerId.safeParse((await params).id);
    const answer = id.success ? await loadAnswer(id.data) : null;
    if (!answer?.message_id) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");
    if (!(await memberRoom(actor, answer.room_id))) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");

    const text = await request.text();
    const body = bodySchema.safeParse(text ? JSON.parse(text) : {});
    if (!body.success) return apiError(400, "INVALID_INPUT", "Send { voted: true } or { voted: false }");

    const { data, error } = await adminSupabase().rpc("set_answer_vote", {
      p_answer: answer.id, p_profile: actor.profile.id, p_voted: body.data.voted ?? null,
    });
    if (error) throw error;
    const row = voteRow.safeParse(Array.isArray(data) ? data[0] : data);
    if (!row.success) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");
    const { total, voted } = row.data;

    // The bot sent the answer, so writing as the bot reaches every member, the voter included.
    const synced = await writeGroupMetadata(answer.room_id, answer.message_id, [BOT_IDS.TA, actor.profile.nexconn_user_id],
      { up: String(total) }, "Upvote");
    if (!synced) console.warn("Upvote saved without a live count update");
    return apiJson<VoteResult>({ upvotes: total, voted });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(400, "INVALID_INPUT", "Send { voted: true } or { voted: false }");
    console.error("Could not upvote the answer");
    return apiError(500, "UPVOTE_FAILED", "Could not save your upvote");
  }
}
