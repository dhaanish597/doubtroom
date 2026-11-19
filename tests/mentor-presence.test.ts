import { describe, expect, it, vi } from "vitest";

import { createPresenceCache, PRESENCE_TTL_MS } from "../src/lib/mentors/presence-cache";
import { dmHref } from "../src/lib/mentors/types";

describe("mentor presence cache", () => {
  it("reuses a status for 30 seconds, then asks Nexconn again", async () => {
    let now = 1_000;
    const lookup = vi.fn(async (userId: string) => userId === "u_online");
    const cache = createPresenceCache(lookup, () => now);

    await cache.onlineStatus(["u_online", "u_offline"]);
    await cache.onlineStatus(["u_online"]);
    expect(lookup).toHaveBeenCalledTimes(2);

    now += PRESENCE_TTL_MS + 1;
    const status = await cache.onlineStatus(["u_online"]);
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(status.get("u_online")).toBe(true);
  });

  it("reports unknown status without caching a failed lookup", async () => {
    const lookup = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(false);
    const cache = createPresenceCache(lookup);

    expect((await cache.onlineStatus(["u_a"])).get("u_a")).toBeNull();
    expect((await cache.onlineStatus(["u_a"])).get("u_a")).toBe(false);
  });

  it("shares one in-flight lookup between concurrent requests", async () => {
    const lookup = vi.fn(async () => true);
    const cache = createPresenceCache(lookup);

    await Promise.all([cache.onlineStatus(["u_a"]), cache.onlineStatus(["u_a", "u_a"])]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe("DM links", () => {
  it("carries the doubt and room so the composer can quote the doubt", () => {
    expect(dmHref("u_abc", { roomId: "r_cs3591_cse_y3", doubtMessageId: "C3K-1" }))
      .toBe("/app/dm/u_abc?doubt=C3K-1&room=r_cs3591_cse_y3");
    expect(dmHref("u_abc")).toBe("/app/dm/u_abc");
  });
});
