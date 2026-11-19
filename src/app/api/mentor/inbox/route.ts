import { connection } from "next/server";

import { mentorInbox } from "@/lib/answers/server";
import type { MentorInboxResponse } from "@/lib/answers/types";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to see your inbox");
    if (actor.kind === "try" || actor.profile.role !== "mentor") {
      return apiError(403, "FORBIDDEN", "The inbox is for seniors");
    }
    return apiJson<MentorInboxResponse>(await mentorInbox(actor));
  } catch {
    console.error("Could not load the mentor inbox");
    return apiError(500, "INBOX_FAILED", "Could not load your inbox");
  }
}
