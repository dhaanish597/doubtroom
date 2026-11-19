import { createHash, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 16;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Compares digests in constant time and
 * refuses every request when the secret is missing or too short to be safe.
 */
export function isCronAuthorized(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH || !header) return false;
  const match = /^Bearer (.+)$/u.exec(header);
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret.trim()));
}
