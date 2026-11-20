import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";
import { NexconnError } from "@/lib/nexconn/server";
import { publicEnv } from "@/lib/public-env";
import { reserveTaRequest } from "@/lib/ratelimit";
import { isRoomDoubtImage } from "@/lib/rooms/doubt-images";
import { memberRoom } from "@/lib/rooms/member-room";
import { mentionPattern } from "@/lib/rooms/timeline";
import { runTaJob, type TaJob } from "./job";

const fields = { roomId: z.string(), messageId: z.string().min(1).max(128), text: z.string().trim().max(2000),
  lang: z.enum(["en", "ta", "tanglish"]).optional() };

export const taRequestSchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...fields, mode: z.literal("doubt"), doubtId: z.uuid(),
    unit: z.string().max(160).optional(), imageUrl: z.url().max(512).optional() })
    .refine(({ text, imageUrl }) => Boolean(text || imageUrl)),
  z.strictObject({ ...fields, mode: z.literal("mention"), text: fields.text.min(1) }),
]);

export type TaRequestBody = z.input<typeof taRequestSchema>;

export type TaAcceptance =
  | { ok: true; duplicate: boolean; run: () => Promise<void> }
  | { ok: false; status: 400 | 404; code: "ROOM_NOT_FOUND" | "INVALID_INPUT"; message: string };

const noop = async () => undefined;

/**
 * Shared entry for the browser relay (/api/ta/ask) and the Nexconn message:send webhook.
 * Validates the request for this actor, reserves it once per message, and returns the work to run.
 */
export async function acceptTaRequest(actor: Actor, body: unknown): Promise<TaAcceptance> {
  const room = await memberRoom(actor, (body as { roomId?: unknown } | null)?.roomId);
  if (!room) return { ok: false, status: 404, code: "ROOM_NOT_FOUND", message: "Room not found" };
  const parsed = taRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, code: "INVALID_INPUT", message: "Check your question and try again" };
  const input = parsed.data;
  if (input.mode === "doubt" && ((input.unit && !room.courses?.units.includes(input.unit))
    || (input.imageUrl && !isRoomDoubtImage(publicEnv.NEXT_PUBLIC_SUPABASE_URL, room.id, input.doubtId, input.imageUrl)))) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "The unit or photo does not match this doubt" };
  }
  if (input.mode === "mention" && !new RegExp(mentionPattern("TA"), "u").test(input.text)) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Mention @TA to ask in Chat" };
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
  if (outcome === "duplicate") return { ok: true, duplicate: true, run: noop };
  return {
    ok: true, duplicate: false,
    run: async () => {
      try {
        await runTaJob(job, actor, outcome);
      } catch (error) {
        console.error("TA answer delivery failed", { code: error instanceof NexconnError ? error.errorCode : undefined });
      }
    },
  };
}
