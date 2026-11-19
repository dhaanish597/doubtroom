import "server-only";
import { adminSupabase } from "@/lib/supabase/admin";
import { embedTexts } from "./embed";
import type { NoteMatch } from "./notes";

export async function retrieveNotes(course: string | null, question: string): Promise<NoteMatch[]> {
  if (!course || !question.trim() || !process.env.GEMINI_API_KEY || !process.env.GEMINI_EMBED_MODEL) return [];
  const signal = AbortSignal.timeout(4500);
  try {
    const [vector] = await embedTexts([question], "RETRIEVAL_QUERY", signal);
    const { data, error } = await adminSupabase().rpc("match_notes", { q: JSON.stringify(vector), course, k: 4 })
      .abortSignal(signal).returns<NoteMatch[]>();
    if (error) throw error;
    return (Array.isArray(data) ? data : []).filter((note) => note.similarity >= 0.55).slice(0, 4);
  } catch {
    console.warn("Course note retrieval unavailable");
    return [];
  }
}
