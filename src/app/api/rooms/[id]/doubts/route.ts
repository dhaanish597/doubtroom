import { connection } from "next/server";
import { z } from "zod";

import type { BoardTab } from "@/lib/answers/rules";
import { roomDoubts } from "@/lib/answers/server";
import type { DoubtBoardResponse } from "@/lib/answers/types";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { roomsForActor } from "@/lib/rooms/server";

const statusTabs: Record<string, BoardTab> = { open: "open", ai_answered: "ai", verified: "verified" };
const querySchema = z.strictObject({ status: z.enum(["open", "ai_answered", "verified"]).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to see doubts");
    const { id } = await params;
    if (!/^[a-z0-9_]{1,64}$/.test(id) || !(await roomsForActor(actor, id)).length) {
      return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    }
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return apiError(400, "INVALID_INPUT", "Status must be open, ai_answered or verified");

    const tab = query.data.status ? statusTabs[query.data.status] : undefined;
    return apiJson<DoubtBoardResponse>(await roomDoubts(id, tab));
  } catch {
    console.error("Could not list room doubts");
    return apiError(500, "DOUBTS_FAILED", "Could not load doubts");
  }
}
