import { z } from "zod";

import { UNVERIFY_WINDOW_MS, answerVerificationMetadata, decideVerification, doubtVerificationMetadata, verifierLabel } from "@/lib/answers/rules";
import { canActorVerify, loadAnswer, writeGroupMetadata } from "@/lib/answers/server";
import type { VerifyResult } from "@/lib/answers/types";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { requestOrigin } from "@/lib/request-origin";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

const answerId = z.uuid();
// { verified: false } undoes a verification. No body verifies.
const bodySchema = z.strictObject({ verified: z.boolean().default(true) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to verify answers");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Verify from DoubtRoom");

    const id = answerId.safeParse((await params).id);
    const answer = id.success ? await loadAnswer(id.data) : null;
    if (!answer?.message_id) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");
    const room = actor.profile.role === "admin" ? { course_code: null } : await memberRoom(actor, answer.room_id);
    if (!room) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");
    if (!(await canActorVerify(actor, { courseCode: room.course_code, isMember: true }))) {
      return apiError(403, "FORBIDDEN", "Only seniors for this subject can verify answers");
    }

    const text = await request.text();
    const body = bodySchema.safeParse(text ? JSON.parse(text) : {});
    if (!body.success) return apiError(400, "INVALID_INPUT", "Send { verified: true } or { verified: false }");
    const { verified } = body.data;

    const decision = decideVerification(verified, {
      authorKind: answer.author_kind, verifiedBy: answer.verified_by, verifiedAt: answer.verified_at,
    }, actor.profile.id);
    if (decision.kind === "deny") return apiError(decision.status, decision.code, decision.message);

    if (decision.kind === "apply") {
      const { data: changed, error } = await adminSupabase().rpc("set_answer_verification", {
        p_answer: answer.id, p_profile: actor.profile.id, p_verified: verified,
        p_window_seconds: UNVERIFY_WINDOW_MS / 1000,
      });
      if (error) throw error;
      if (!changed) return apiError(409, "VERIFY_CONFLICT", "This answer just changed. Refresh and try again.");
    }

    // Metadata always mirrors the stored state, so a retry heals a failed live update.
    const current = await loadAnswer(answer.id);
    if (!current) return apiError(404, "ANSWER_NOT_FOUND", "Answer not found");
    const isVerified = Boolean(current.verified_at);
    const { profile } = actor;
    // Another senior's earlier verification keeps the metadata that senior wrote.
    const answerMetadata = !isVerified ? answerVerificationMetadata({ verified: false })
      : current.verified_by === profile.id ? answerVerificationMetadata({
        verified: true, verifierId: profile.nexconn_user_id,
        label: verifierLabel(profile.display_name, profile.year, profile.dept),
        at: Date.parse(current.verified_at ?? "") || Date.now(),
      }) : null;

    const writes: Promise<boolean>[] = [];
    if (answerMetadata) {
      writes.push(writeGroupMetadata(answer.room_id, answer.message_id, [BOT_IDS.TA, actor.profile.nexconn_user_id],
        answerMetadata, "Verify answer"));
    }
    const doubt = answer.doubts;
    if (doubt?.message_id) {
      const doubtVerified = isVerified || (await doubtStatus(doubt.id)) === "verified";
      writes.push(writeGroupMetadata(answer.room_id, doubt.message_id,
        [doubt.asker?.nexconn_user_id ?? "", BOT_IDS.TA], doubtVerificationMetadata(doubtVerified, doubt.id), "Verify doubt"));
    }
    const synced = (await Promise.all(writes)).every(Boolean);
    if (!synced) return apiError(502, "SYNC_FAILED", "Saved, but the room didn’t update. Try again.");
    return apiJson<VerifyResult>({ ok: true, verified: isVerified, metadata: answerMetadata ?? undefined });
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(400, "INVALID_INPUT", "Send { verified: true } or { verified: false }");
    console.error("Could not verify the answer");
    return apiError(500, "VERIFY_FAILED", "Could not verify the answer");
  }
}

async function doubtStatus(doubtId: string) {
  const { data, error } = await adminSupabase().from("doubts").select("status").eq("id", doubtId)
    .maybeSingle<{ status: string }>();
  if (error) throw error;
  return data?.status;
}
