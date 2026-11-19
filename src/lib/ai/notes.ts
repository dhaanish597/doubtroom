import { z } from "zod";

export const pdfLimit = 20 * 1024 * 1024;
export const noteFields = z.object({
  courseCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,16}$/),
  title: z.string().trim().min(1).max(120),
});
export type NoteMatch = { source_title: string; page: number | null; content: string; similarity: number };

export function chunkPages(pages: string[]) {
  const chunks: { content: string; page: number }[] = [];
  for (const [index, page] of pages.entries()) {
    const words = page.trim().split(/\s+/u).filter(Boolean);
    // About 800 English tokens per chunk, with 100 tokens shared between neighbours.
    for (let start = 0; start < words.length; start += 525) {
      chunks.push({ page: index + 1, content: words.slice(start, start + 600).join(" ") });
      if (start + 600 >= words.length) break;
    }
  }
  return chunks;
}

export function citeAnswer(markdown: string, examTip: string | undefined, notes: NoteMatch[]) {
  const sources: { title: string; page?: number }[] = [];
  const cite = (text: string) => text.replace(/\[S(\d+)\]/g, (_, n: string) => {
    const note = notes[Number(n) - 1];
    if (!note) return "";
    const page = note.page ?? undefined;
    let index = sources.findIndex((s) => s.title === note.source_title && s.page === page);
    if (index === -1) index = sources.push({ title: note.source_title, page }) - 1;
    return `[S${index + 1}]`;
  });
  return { markdown: cite(markdown), examTip: examTip && cite(examTip), sources };
}
