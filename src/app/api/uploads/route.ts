import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-response";
import { getActor } from "@/lib/auth/actor";
import { requestOrigin } from "@/lib/request-origin";
import { doubtImageBucket, doubtImageExtensions, doubtImageLimit, doubtImageStem } from "@/lib/rooms/doubt-images";
import { memberRoom } from "@/lib/rooms/member-room";
import { adminSupabase } from "@/lib/supabase/admin";

const uploadSchema = z.strictObject({
  roomId: z.string(),
  doubtId: z.uuid(),
  contentType: z.enum(Object.keys(doubtImageExtensions) as (keyof typeof doubtImageExtensions)[]),
  size: z.number().int().positive().max(doubtImageLimit),
});

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return apiError(401, "UNAUTHORIZED", "Sign in to attach a photo");
    if (request.headers.get("origin") !== requestOrigin(request)) return apiError(403, "FORBIDDEN", "Upload from DoubtRoom");
    const body = await request.json().catch(() => null);
    if (!(await memberRoom(actor, body?.roomId))) return apiError(404, "ROOM_NOT_FOUND", "Room not found");
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) return apiError(400, "INVALID_INPUT", "Choose a JPEG, PNG, WebP or HEIC photo up to 5 MB");
    const { roomId, doubtId, contentType } = parsed.data;
    const path = `${doubtImageStem(roomId, doubtId)}.${doubtImageExtensions[contentType]}`;
    const bucket = adminSupabase().storage.from(doubtImageBucket);
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error) throw error;
    return apiJson({ uploadUrl: data.signedUrl, publicUrl: bucket.getPublicUrl(path).data.publicUrl });
  } catch {
    return apiError(500, "UPLOAD_FAILED", "Could not prepare the photo upload");
  }
}
