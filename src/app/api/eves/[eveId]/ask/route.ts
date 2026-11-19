import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { answerDoubt } from "@/lib/ai/answer";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor, type Actor } from "@/lib/auth/actor";
import { eveForActor } from "@/lib/eves/server";
import { evePhase } from "@/lib/eves/time";
import type { EveSummary } from "@/lib/eves/types";
import { BOT_IDS } from "@/lib/nexconn/ids";
import { MSG, type AnswerContent } from "@/lib/nexconn/messages";
import { NexconnError, sendOpenCustom } from "@/lib/nexconn/server";
import { reserveTaRequest } from "@/lib/ratelimit";
import { requestOrigin } from "@/lib/request-origin";
import { mentionPattern } from "@/lib/rooms/timeline";

export const maxDuration = 45;

const bodySchema = z.strictObject({
  messageId: z.string().min(1).max(128),
  text: z.string().trim().min(1).max(2000),
});

type EveJob = { eve: EveSummary; messageId: string; text: string };

/** Answers an @TA mention inside the Eve with the Phase 5 path: same prompt, quotas and providers. */
async function runJob(job: EveJob, actor: Actor, outcome: "allowed" | "daily" | "room") {
  const response = outcome === "allowed"
    ? await answerDoubt({
      text: job.text, mention: true, lang: "en", courseCode: job.eve.courseCode, courseTitle: job.eve.title,
      profileId: actor.profile.id,
    })
    : { ok: false as const };
  const failureText = outcome === "daily" ? "Daily TA limit reached. Someone here can still help."
    : outcome === "room" ? "The TA just got another question. Give it a few seconds."
      : "I couldn’t answer this one. Try asking it another way.";
  const answer: AnswerContent = {
    v: 1, answerId: randomUUID(), doubtMessageId: job.messageId, lang: "en", quotedText: job.text,
    markdown: response.ok ? response.markdown : failureText,
    examTip: response.ok ? response.examTip : undefined,
    model: response.ok ? response.model : "unavailable", failed: !response.ok,
  };
  // Open channels keep only recent messages for people entering. Nothing is stored in our database.
  await sendOpenCustom(BOT_IDS.TA, job.eve.id, MSG.ANSWER, answer, { shouldPersist: 1, isEchoToSender: 0 });
}

export async function POST(request: Request, { params }: { params: Promise<{ eveId: string }> }) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to ask the TA");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Ask from DoubtRoom");
    const eve = await eveForActor(actor, (await params).eveId);
    if (!eve) return apiError(404, "EVE_NOT_FOUND", "Exam Eve not found");
    if (evePhase(eve, new Date()) !== "live") return apiError(409, "EVE_CLOSED", "This Eve isn’t live");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check your question and try again");
    if (!new RegExp(mentionPattern("TA"), "u").test(parsed.data.text)) {
      return apiError(400, "INVALID_INPUT", "Mention @TA to ask");
    }

    const job: EveJob = { eve, ...parsed.data };
    // Quotas are shared with the subject room: the ledger row uses its room ID.
    const outcome = await reserveTaRequest(actor, {
      roomId: eve.roomId, messageId: job.messageId, text: job.text, lang: "en", qHash: null,
    });
    if (outcome !== "duplicate") {
      after(async () => {
        try {
          await runJob(job, actor, outcome);
        } catch (error) {
          console.error("Eve TA delivery failed", { code: error instanceof NexconnError ? error.errorCode : undefined });
        }
      });
    }
    return apiJson({ accepted: true }, 202);
  } catch (error) {
    console.error("Could not accept the Eve TA request", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(500, "TA_FAILED", "Could not ask the TA");
  }
}
