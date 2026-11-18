import { describe, expect, it } from "vitest";
import {
  MSG,
  safeParseAnnounce,
  safeParseAnswer,
  safeParseDoubt,
  safeParseRecap,
} from "../src/lib/nexconn/messages";

const doubt = { v: 1, doubtId: "d1", text: "How does TCP establish a connection?" };
const answer = {
  v: 1,
  answerId: "a1",
  doubtMessageId: "msg1",
  markdown: "TCP uses a three-way handshake.",
  lang: "en",
  model: "test-model",
  quotedText: doubt.text,
};
const announce = { v: 1, title: "Room change", body: "Meet in A101." };
const recap = {
  v: 1,
  date: "2026-11-24",
  items: [{ doubtMessageId: "msg1", question: doubt.text, answerSummary: "A three-way handshake." }],
};

describe("custom Nexconn messages", () => {
  it("keeps the four registered type names stable", () => {
    expect(Object.values(MSG)).toEqual(["dr:doubt", "dr:answer", "dr:announce", "dr:recap"]);
  });

  it.each([
    { type: MSG.DOUBT, parse: safeParseDoubt, payload: doubt },
    { type: MSG.ANSWER, parse: safeParseAnswer, payload: answer },
    { type: MSG.ANNOUNCE, parse: safeParseAnnounce, payload: announce },
    { type: MSG.RECAP, parse: safeParseRecap, payload: recap },
  ])("parses $type objects and JSON, rejecting invalid versions and malformed JSON", ({ parse, payload }) => {
    expect(parse(payload)).toMatchObject({ success: true, data: payload });
    expect(parse(JSON.stringify(payload))).toMatchObject({ success: true, data: payload });
    expect(parse({ ...payload, v: 2 }).success).toBe(false);
    expect(parse({ ...payload, v: "1" }).success).toBe(false);
    expect(parse("{broken").success).toBe(false);
    expect(parse(null).success).toBe(false);
  });

  it("accepts optional doubt fields and rejects unsupported languages", () => {
    expect(safeParseDoubt({
      ...doubt, unit: "Unit 1", imageUrl: "https://example.com/doubt.png", courseCode: "CS3591", lang: "ta",
    }).success).toBe(true);
    expect(safeParseDoubt({ ...doubt, lang: "fr" }).success).toBe(false);
    expect(safeParseDoubt({ ...doubt, text: undefined }).success).toBe(false);
  });

  it("validates answer requirements and nested sources", () => {
    expect(safeParseAnswer({
      ...answer, doubtId: "d1", examTip: "Draw the handshake", sources: [{ title: "Notes", page: 2 }], failed: false,
    }).success).toBe(true);
    expect(safeParseAnswer({ ...answer, lang: undefined }).success).toBe(false);
    expect(safeParseAnswer({ ...answer, sources: [{ title: "Notes", page: "2" }] }).success).toBe(false);
  });

  it("validates announcement urgency and recap items", () => {
    expect(safeParseAnnounce({ ...announce, urgent: true }).success).toBe(true);
    expect(safeParseAnnounce({ ...announce, urgent: "true" }).success).toBe(false);
    expect(safeParseRecap({ ...recap, items: [{ ...recap.items[0], verifiedBy: "demo_mentor" }] }).success).toBe(true);
    expect(safeParseRecap({ ...recap, items: [{ question: "Missing fields" }] }).success).toBe(false);
  });
});
