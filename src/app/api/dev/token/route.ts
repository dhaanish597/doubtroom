import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { DEV_ROOM_ID, DEV_ROOM_NAME } from "@/lib/nexconn/dev-room";
import { ensureGroup, issueToken, joinGroup, NexconnError } from "@/lib/nexconn/server";

const querySchema = z.object({
  userId: z.string().regex(/^dev_[a-z0-9_]{1,60}$/),
  name: z.string().trim().min(1).max(64),
});

const noStore = { "Cache-Control": "no-store" };

function failure(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: noStore });
}

function authorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("x-dev-key");
  if (!expected || !supplied) return false;

  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) return failure(403, "FORBIDDEN", "A valid dev key is required");

  const query = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ userId: query.get("userId"), name: query.get("name") });
  if (!parsed.success) return failure(400, "INVALID_INPUT", "Enter a dev_ user ID and a display name");

  const { userId, name } = parsed.data;
  try {
    const token = await issueToken(userId, name);
    await ensureGroup(DEV_ROOM_ID, DEV_ROOM_NAME);
    await joinGroup(DEV_ROOM_ID, [userId]);
    return Response.json({ userId, token, roomId: DEV_ROOM_ID }, { headers: noStore });
  } catch (error) {
    if (error instanceof NexconnError && error.errorCode === "NOT_CONFIGURED") {
      return failure(503, "NOT_CONFIGURED", "Nexconn server credentials and domains are required");
    }
    // Vendor messages and exception objects may contain request or response credentials.
    const code = error instanceof NexconnError ? error.errorCode : "UNEXPECTED";
    console.warn("Dev chat token request failed", { code });
    return failure(502, "NEXCONN_ERROR", "Nexconn could not prepare the test chat");
  }
}
