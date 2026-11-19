import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ingestPdf, NoteInputError } from "@/lib/ai/ingest";
import { noteFields, pdfLimit } from "@/lib/ai/notes";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { isAdminActor } from "@/lib/moderation/server";
import { requestOrigin } from "@/lib/request-origin";
import { adminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 240;
const staged = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), size: z.number().int().positive().max(pdfLimit) }),
  noteFields.extend({ action: z.literal("index"), uploadId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in first");
    if (!(await isAdminActor(actor)) || request.headers.get("origin") !== requestOrigin(request)) {
      return apiError(403, "FORBIDDEN", "Upload notes from the admin page");
    }
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_EMBED_MODEL) {
      return apiError(503, "EMBEDDINGS_UNAVAILABLE", "Configure Gemini embeddings before uploading notes.");
    }
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (Number(request.headers.get("content-length")) > pdfLimit + 65536) {
        return apiError(413, "TOO_LARGE", "Choose a PDF up to 20 MB.");
      }
      const form = await request.formData();
      const fields = noteFields.safeParse(Object.fromEntries(form));
      const file = form.get("file");
      if (!fields.success || !(file instanceof File) || file.size > pdfLimit) {
        return apiError(400, "INVALID_INPUT", "Supply a course, title and PDF up to 20 MB.");
      }
      return apiJson(await ingestPdf(fields.data.courseCode, fields.data.title, new Uint8Array(await file.arrayBuffer())));
    }

    const parsed = staged.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check the course, title and PDF.");
    const input = parsed.data;
    const bucket = adminSupabase().storage.from("course-note-uploads");
    const uploadId = input.action === "prepare" ? randomUUID() : input.uploadId;
    const path = `${actor.profile.id}/${uploadId}.pdf`;
    if (input.action === "prepare") {
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error) throw error;
      return apiJson({ uploadId, uploadUrl: data.signedUrl });
    }
    const { data, error } = await bucket.download(path);
    if (error || !data) return apiError(400, "MISSING_FILE", "Upload the PDF again.");
    try {
      return apiJson(await ingestPdf(input.courseCode, input.title, new Uint8Array(await data.arrayBuffer())));
    } finally {
      const removed = await bucket.remove([path]);
      if (removed.error) console.warn("Could not clear staged course note");
    }
  } catch (error) {
    if (error instanceof NoteInputError) return apiError(400, "INVALID_NOTE", error.message);
    console.warn("Course note import failed");
    return apiError(502, "INDEX_FAILED", "Couldn’t index these notes. Check the embedding provider and try again.");
  }
}
