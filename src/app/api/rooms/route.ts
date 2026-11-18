import { connection } from "next/server";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { roomsForActor } from "@/lib/rooms/server";

export async function GET(request: Request) {
  await connection();
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to see your rooms");
    return apiJson({ rooms: await roomsForActor(actor) });
  } catch {
    console.error("Could not load room memberships");
    return apiError(500, "ROOMS_FAILED", "Could not load your rooms");
  }
}
