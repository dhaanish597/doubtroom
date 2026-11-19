import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { DEMO_NOTE_TITLE } from "@/lib/ai/demo-note";
import { citeAnswer } from "@/lib/ai/notes";
import { retrieveNotes } from "@/lib/ai/retrieve";
import { answerDoubt } from "@/lib/ai/answer";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor, type Actor } from "@/lib/auth/actor";
import { BOT_IDS, DEMO_ROOM_ID } from "@/lib/nexconn/ids";
import { MSG, type AnswerContent } from "@/lib/nexconn/messages";
import { NexconnError, sendGroupCustom, setMessageMetadata } from "@/lib/nexconn/server";
import { reserveTaRequest } from "@/lib/ratelimit";
import { requestOrigin } from "@/lib/request-origin";
import { publicEnv } from "@/lib/public-env";
import { isRoomDoubtImage } from "@/lib/rooms/doubt-images";
import { mentionPattern } from "@/lib/rooms/timeline";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 45;

const fields = { roomId: z.string(), messageId: z.string().min(1).max(128), text: z.string().trim().max(2000),
  lang: z.enum(["en", "ta", "tanglish"]).optional() };
const bodySchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...fields, mode: z.literal("doubt"), doubtId: z.uuid(),
    unit: z.string().max(160).optional(), imageUrl: z.url().max(512).optional() })
    .refine(({ text, imageUrl }) => Boolean(text || imageUrl)),
  z.strictObject({ ...fields, mode: z.literal("mention"), text: fields.text.min(1) }),
]);

type TaJob = {
  roomId: string;
  messageId: string;
  doubtId?: string;
  text: string;
  unit?: string;
  imageUrl?: string;
  lang: "en" | "ta" | "tanglish";
  mention: boolean;
  courseCode: string | null;
  courseTitle: string;
  qHash: string | null;
};

async function cachedAnswer(job: TaJob) {
  if (!job.qHash) return null;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const query = adminSupabase().from("answers")
    .select("body_md,sources,model,exam_tip,confidence,verified_at,doubts!inner(q_hash,lang,unit)")
    .eq("room_id", job.roomId).eq("doubts.q_hash", job.qHash).eq("doubts.lang", job.lang)
    .gte("created_at", since).not("message_id", "is", null)
    .or("verified_at.not.is.null,and(confidence.eq.high,from_cache.eq.false)");
  const { data, error } = await (job.unit ? query.eq("doubts.unit", job.unit) : query.is("doubts.unit", null))
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }).limit(1).maybeSingle<{
      body_md: string; sources: AnswerContent["sources"] | null; model: string | null; exam_tip: string | null;
      confidence: "high" | "medium" | "low" | null; verified_at: string | null;
    }>();
  if (error) {
    console.warn("Could not read the TA answer cache", { code: error.code });
    return null;
  }
  return data ? {
    ok: true as const, sources: data.sources ?? [], markdown: data.body_md, examTip: data.exam_tip ?? undefined,
    model: data.model ?? "cached", confidence: data.verified_at ? "high" as const : data.confidence ?? "high" as const,
  } : null;
}

async function updateDoubtMetadata(job: TaJob, actor: Actor, answerMessageId: string, failed: boolean) {
  const metadata = { st: failed ? "failed" : "ai", ans: answerMessageId, did: job.doubtId ?? "" };
  for (const userId of [actor.profile.nexconn_user_id, BOT_IDS.TA]) {
    try {
      await setMessageMetadata(3, job.roomId, job.messageId, userId, metadata);
      console.info("TA doubt metadata updated", { writer: userId === BOT_IDS.TA ? "bot" : "asker" });
      return;
    } catch (error) {
      console.warn("TA doubt metadata update failed", { writer: userId === BOT_IDS.TA ? "bot" : "asker",
        code: error instanceof NexconnError ? error.errorCode : undefined });
    }
  }
}

async function runJob(job: TaJob, actor: Actor, outcome: "allowed" | "daily" | "room") {
  const cached = outcome === "allowed" ? await cachedAnswer(job) : null;
  const matches = outcome === "allowed" && !cached ? await retrieveNotes(job.courseCode, job.text) : [];
  const notes = job.roomId === DEMO_ROOM_ID ? matches.filter(note => note.source_title === DEMO_NOTE_TITLE) : matches;
  const notesContext = notes.map((note, i) => `[S${i + 1}] ${note.content}`).join("\n\n");
  const response = outcome === "allowed"
    ? cached ?? await answerDoubt({ ...job, notesContext, profileId: actor.profile.id })
    : { ok: false as const };
  const failureText = outcome === "daily" ? "Daily TA limit reached. A senior can still help."
    : outcome === "room" ? "The TA just received another question. Give it a few seconds, or ask a senior."
      : "I couldn’t answer this one. A senior can still help.";

  const cited = cached ?? (response.ok ? citeAnswer(response.markdown, response.examTip, notes) : null);
  const answer: AnswerContent = {
    v: 1, answerId: randomUUID(), doubtId: job.doubtId, doubtMessageId: job.messageId,
    lang: job.lang, quotedText: job.text || "Photo doubt",
    markdown: cited?.markdown ?? failureText,
    sources: cited?.sources.length ? cited.sources : undefined,
    examTip: cited?.examTip,
    model: response.ok ? response.model : "unavailable", failed: !response.ok,
    ...(cached ? { cached: true } : {}),
  };
  const result = await sendGroupCustom(BOT_IDS.TA, job.roomId, MSG.ANSWER, answer, {
    hasMetadata: true, metadata: { up: "0", ver: "0" }, isEchoToSender: 0, shouldPersist: 1,
    pushContent: response.ok ? "DoubtRoom TA answered a doubt" : undefined,
  });
  const messageId = result?.messageIds?.find((delivery) => delivery.channelId === job.roomId)?.messageId;
  if (!messageId) throw new Error("Missing Nexconn answer message ID");

  const db = adminSupabase();
  if (response.ok) {
    const { error } = await db.rpc(answer.sources?.length ? "finish_grounded_answer" : "finish_ta_answer", {
      p_answer: answer.answerId, p_doubt: job.doubtId ?? null, p_room: job.roomId, p_message: messageId,
      ...(answer.sources?.length ? { p_sources: answer.sources } : {}),
      p_body: answer.markdown, p_model: response.model, p_tip: answer.examTip ?? null, p_confidence: response.confidence,
      p_from_cache: Boolean(cached),
    });
    if (error) console.error("Could not persist TA answer", { code: error.code });
  } else if (job.doubtId && outcome === "allowed") {
    const { error } = await db.from("doubts").update({ status: "failed" }).eq("id", job.doubtId).eq("status", "open");
    if (error) console.error("Could not mark failed doubt", { code: error.code });
  }
  if (job.doubtId) await updateDoubtMetadata(job, actor, messageId, !response.ok);
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to ask the TA");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Ask from DoubtRoom");
    const body = await request.json().catch(() => null);
    const room = await memberRoom(actor, body?.roomId);
    if (!room) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check your question and try again");
    const input = parsed.data;
    if (input.mode === "doubt" && ((input.unit && !room.courses?.units.includes(input.unit))
      || (input.imageUrl && !isRoomDoubtImage(publicEnv.NEXT_PUBLIC_SUPABASE_URL, room.id, input.doubtId, input.imageUrl)))) {
      return apiError(400, "INVALID_INPUT", "The unit or photo does not match this doubt");
    }

    if (input.mode === "mention" && !new RegExp(mentionPattern("TA"), "u").test(input.text)) {
      return apiError(400, "INVALID_INPUT", "Mention @TA to ask in Chat");
    }

    const job: TaJob = {
      ...input, lang: input.lang ?? actor.profile.lang, mention: input.mode === "mention", courseCode: room.course_code,
      courseTitle: room.courses?.title ?? room.title, qHash: null,
    };
    if (!job.mention && !job.imageUrl && job.courseCode) {
      const normalized = job.text.normalize("NFKC").replace(/\s+/gu, " ").trim();
      job.qHash = createHash("sha256").update(JSON.stringify([normalized, job.courseCode])).digest("hex");
    }
    const outcome = await reserveTaRequest(actor, job);
    if (outcome !== "duplicate") {
      after(async () => {
        try {
          await runJob(job, actor, outcome);
        } catch (error) {
          console.error("TA answer delivery failed", { code: error instanceof NexconnError ? error.errorCode : undefined });
        }
      });
    }
    return apiJson({ accepted: true }, 202);
  } catch (error) {
    console.error("Could not accept TA request", { code: error instanceof NexconnError ? error.errorCode : undefined });
    return apiError(500, "TA_FAILED", "Could not ask the TA");
  }
}
