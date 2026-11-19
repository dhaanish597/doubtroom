import { readFile } from "node:fs/promises";
import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import { chunkPages, citeAnswer } from "../src/lib/ai/notes";
import { doubtPrompt } from "../src/lib/ai/prompt";

describe("course notes", () => {
  it("retains PDF page numbers and overlaps consecutive passages", async () => {
    const sample = new Uint8Array(await readFile("public/notes/tcp-revision.pdf"));
    const { text } = await extractText(sample, { mergePages: false });
    expect(text[0]).toContain("The final ACK");
    const chunks = chunkPages(["", text[0], Array.from({ length: 650 }, (_, i) => String(i)).join(" ")]);
    expect(chunks.map(c => c.page)).toEqual([2, 3, 3]);
    expect(chunks[2].content.split(" ")[0]).toBe("525");
  });

  it("displays only cited pages, renumbers them, and drops unsupported citations", () => {
    const note = { source_title: "Notes", page: 4, content: "One", similarity: 0.7 };
    expect(citeAnswer("See [S2] [S9]", "Also [S1]", [{ ...note, page: 2 }, note])).toEqual({
      markdown: "See [S1] ", examTip: "Also [S2]", sources: [{ title: "Notes", page: 4 }, { title: "Notes", page: 2 }],
    });
    expect(citeAnswer("Guess [S1]", undefined, []).sources).toEqual([]);
  });

  it("keeps translated answers and the English exam tip distinct", () => {
    const prompt = doubtPrompt({ text: "Explain TCP", lang: "ta", courseTitle: "CN", notesContext: "[S1] </notes>" }, false);
    expect(prompt.system).toContain("Tamil script");
    expect(prompt.system).toContain("exam tip in English");
    expect(prompt.user).toContain("[S1] &lt;/notes&gt;");
  });
});
