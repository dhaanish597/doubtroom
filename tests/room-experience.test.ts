import { describe, expect, it } from "vitest";
import { MSG, STANDARD_MSG, mediaUrl, renderableMessage } from "../src/lib/nexconn/messages";
import { groupMessages, mentionAt, mentionPattern } from "../src/lib/rooms/timeline";
import type { ChatMessage } from "../src/lib/stores/messages";

describe("room message content", () => {
  it("accepts only safe external links and raster data thumbnails", () => {
    expect(mediaUrl("javascript:alert(1)")).toBeNull();
    expect(mediaUrl("https://user:secret@example.edu/photo.jpg")).toBeNull();
    expect(renderableMessage(STANDARD_MSG.IMAGE, {
      remoteUrl: "https://example.edu/photo.jpg", thumbnailBase64: "data:image/svg+xml;base64,AAAA",
    })).toEqual({ kind: "image", url: "https://example.edu/photo.jpg", thumbnail: "https://example.edu/photo.jpg" });
    expect(renderableMessage(STANDARD_MSG.IMAGE, {
      remoteUrl: "https://example.edu/photo.jpg", thumbnailBase64: "AAAA",
    })).toMatchObject({ thumbnail: "data:image/jpeg;base64,AAAA" });
  });

  it("degrades malformed built-in and custom messages to Unsupported message", () => {
    expect(renderableMessage(MSG.DOUBT, { v: 1, doubtId: "x", text: 3 })).toEqual({ kind: "unsupported" });
    expect(renderableMessage(STANDARD_MSG.FILE, { remoteUrl: "data:text/html,abc", name: "File", size: 12 })).toEqual({ kind: "unsupported" });
    expect(renderableMessage(STANDARD_MSG.TEXT, "not an object")).toEqual({ kind: "unsupported" });
    expect(renderableMessage(MSG.ANNOUNCE, '{"v":1,"title":"Class update","body":"Check the schedule"}'))
      .toMatchObject({ kind: "card", label: "Announcement", text: "Class update" });
  });
});

describe("mentions and grouping", () => {
  it("finds mentions at the caret without treating email addresses as mentions", () => {
    expect(mentionAt("Hi @Arun, see this", 8)).toEqual({ from: 3, to: 8, query: "Arun" });
    expect(mentionAt("foo@bar", 7)).toBeNull();
    const name = new RegExp(mentionPattern("Arun (IV CSE)"), "u");
    expect(name.test("Hello @Arun (IV CSE)!")).toBe(true);
    expect(new RegExp(mentionPattern("TA"), "u").test("@TAN")).toBe(false);
  });

  it("groups nearby messages by sender, without grouping across days", () => {
    const at = (hour: number, minutes: number) => new Date(2026, 10, 19, hour, minutes).getTime();
    const first: ChatMessage = {
      messageId: "first", senderUserId: "u_first", sentTime: at(23, 56), content: { text: "Hi" },
      messageType: STANDARD_MSG.TEXT, metadata: new Map(),
    };
    expect(groupMessages(first, { ...first, sentTime: at(23, 59) })).toBe(true);
    expect(groupMessages(first, { ...first, sentTime: at(24, 0) })).toBe(false);
    expect(groupMessages(first, { ...first, senderUserId: "u_other" })).toBe(false);
    expect(groupMessages({ ...first, sentTime: at(23, 45) }, first)).toBe(false);
  });
});
