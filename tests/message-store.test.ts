import type { Message } from "@nexconn/chat";
import { beforeEach, describe, expect, it } from "vitest";

import { channelKeyFor, useMessages } from "../src/lib/stores/messages";

function message(messageId: string, sentTime: number, channelId = "devroom") {
  const channelIdentifier = { channelType: 3, channelId } satisfies Pick<
    Message["channelIdentifier"], "channelType" | "channelId"
  >;
  return {
    channelIdentifier,
    messageId,
    sentTime,
    senderUserId: "dev_alice",
    messageType: "RC:TxtMsg",
    content: { text: messageId },
    metadata: new Map([["ver", "0"]]),
  };
}

describe("Nexconn message store", () => {
  beforeEach(() => useMessages.getState().reset());

  it("deduplicates messages across history and live events, sorted within each channel", () => {
    const later = message("later", 20);
    const earlier = message("earlier", 10);
    useMessages.getState().mergeMessages([later]);
    useMessages.getState().mergeMessages([later, earlier, message("later", 20, "other")]);

    const { byChannel } = useMessages.getState();
    expect(byChannel["3:devroom"].map((item) => item.messageId)).toEqual(["earlier", "later"]);
    expect(byChannel["3:other"].map((item) => item.messageId)).toEqual(["later"]);
  });

  it("keeps metadata received before history and preserves later updates across refetches", () => {
    const item = message("answer", 20);
    const store = useMessages.getState();
    store.mergeMetadata(item.channelIdentifier, item.messageId, { ver: "1" });
    store.mergeMessages([item]);
    store.mergeMetadata(item.channelIdentifier, item.messageId, { up: "3" });
    store.mergeMessages([item]);

    const key = channelKeyFor(item.channelIdentifier);
    expect(Object.fromEntries(useMessages.getState().byChannel[key][0].metadata)).toEqual({ ver: "1", up: "3" });
  });
});
