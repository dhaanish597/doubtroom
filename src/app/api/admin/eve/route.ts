import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { EveError, createEve, isAdminActor } from "@/lib/eves/server";
import { requestOrigin } from "@/lib/request-origin";

const bodySchema = z.strictObject({
  courseCode: z.string().trim().regex(/^[A-Za-z0-9]{2,16}$/).transform((code) => code.toUpperCase()),
  opensAt: z.iso.datetime({ offset: true }),
  closesAt: z.iso.datetime({ offset: true }),
});

const windowMessages: Record<string, string> = {
  order: "The Eve must close after it opens.",
  past: "That closing time has already passed.",
  too_long: "An Eve can last at most 24 hours.",
  too_far: "An Eve must close within 7 days from now.",
};

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in first");
    if (!isAdminActor(actor)) return apiError(403, "FORBIDDEN", "Only admins can create an Exam Eve");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Create Eves from DoubtRoom");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Check the course and times");

    const { courseCode, opensAt, closesAt } = parsed.data;
    const eve = await createEve(courseCode, { opensAt: new Date(opensAt), closesAt: new Date(closesAt) });
    return apiJson({ eveId: eve.eveId, roomId: eve.roomId, ttlMinutes: eve.ttlMinutes }, 201);
  } catch (error) {
    if (error instanceof EveError) {
      switch (error.code) {
        case "INVALID_WINDOW": return apiError(400, "INVALID_WINDOW", windowMessages[error.message] ?? "Check the times");
        case "COURSE_NOT_FOUND": return apiError(404, error.code, "We couldn’t find that course");
        case "ROOM_NOT_FOUND": return apiError(409, error.code, "That course has no room yet. Sync rooms first.");
        case "EVE_EXISTS": return apiError(409, error.code, "This course already has an Eve that night");
        case "CHANNEL_FAILED": return apiError(502, error.code, "Chat couldn’t create the Eve. Try again.");
      }
    }
    console.error("Could not create the Exam Eve", { reason: error instanceof Error ? error.name : "error" });
    return apiError(500, "EVE_FAILED", "Could not create the Eve");
  }
}
