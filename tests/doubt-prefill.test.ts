import { describe, expect, it } from "vitest";

import { doubtPrefill } from "../src/lib/mentors/types";

describe("DM doubt prefill", () => {
  it("quotes the doubt with the room title", () => {
    expect(doubtPrefill("Computer Networks", "Why is TCP reliable?"))
      .toBe('About my doubt in Computer Networks: "Why is TCP reliable?"');
  });

  it("speaks to the student when a senior opens the DM", () => {
    expect(doubtPrefill("Computer Networks", "Why is TCP reliable?", false))
      .toBe('About your doubt in Computer Networks: "Why is TCP reliable?"');
  });

  it("shortens very long doubts", () => {
    const text = doubtPrefill("CN", "x".repeat(2_000));
    expect(text.length).toBeLessThan(700);
    expect(text.endsWith('…"')).toBe(true);
  });
});
