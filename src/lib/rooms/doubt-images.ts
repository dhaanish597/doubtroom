export const doubtImageBucket = "doubt-images";
export const doubtImageLimit = 5 * 1024 * 1024;
export const doubtImageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
} as const;
export type DoubtImageType = keyof typeof doubtImageExtensions;

export function isDoubtImageType(value: string): value is DoubtImageType {
  return Object.hasOwn(doubtImageExtensions, value);
}

export function doubtImageStem(roomId: string, doubtId: string) {
  return `doubts/${roomId}/${doubtId}`;
}

export function isRoomDoubtImage(supabaseUrl: string | undefined, roomId: string, doubtId: string, url: string) {
  if (!supabaseUrl || !/^[a-z0-9_]{1,64}$/.test(roomId) || !/^[a-f0-9-]{36}$/i.test(doubtId)) return false;
  const base = supabaseUrl.replace(/\/+$/, "");
  const stem = doubtImageStem(roomId, doubtId);
  return Object.values(doubtImageExtensions).some((extension) =>
    url === `${base}/storage/v1/object/public/${doubtImageBucket}/${stem}.${extension}`);
}
