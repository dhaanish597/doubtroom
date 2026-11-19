import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import { adminSupabase } from "@/lib/supabase/admin";
import { embedTexts } from "./embed";
import { chunkPages, noteFields, pdfLimit } from "./notes";

export class NoteInputError extends Error {}

export async function ingestPdf(courseCode: string, title: string, bytes: Uint8Array) {
  const fields = noteFields.parse({ courseCode, title });
  if (!bytes.length || bytes.length > pdfLimit || !Buffer.from(bytes.subarray(0, 8)).toString().startsWith("%PDF-")) {
    throw new NoteInputError("Choose a PDF up to 20 MB.");
  }
  const db = adminSupabase();
  const course = await db.from("courses").select("code").eq("code", fields.courseCode).maybeSingle();
  if (course.error) throw course.error;
  if (!course.data) throw new NoteInputError("Choose a course in the catalog.");
  const pages = await (async () => {
    const doc = await getDocumentProxy(bytes);
    try { return (await extractText(doc, { mergePages: false })).text; }
    finally { await doc.loadingTask.destroy(); }
  })().catch(() => { throw new NoteInputError("We couldn’t read this PDF. Try an unlocked copy with selectable text."); });
  const chunks = chunkPages(pages);
  if (!chunks.length) throw new NoteInputError("This PDF has no selectable text. Run text recognition on the scan first.");
  const vectors = await embedTexts(chunks.map(({ content }) => content), "RETRIEVAL_DOCUMENT", AbortSignal.timeout(180_000));
  const { error } = await db.rpc("replace_course_note", { p_course: fields.courseCode, p_title: fields.title,
    p_chunks: chunks.map((chunk, i) => ({ ...chunk, embedding: JSON.stringify(vectors[i]) })) });
  if (error) throw error;
  return { pages: pages.length, chunks: chunks.length };
}
