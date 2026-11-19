import { createHmac } from "node:crypto";

export const TRY_ATTEMPTS_PER_HOUR = 10;
export const TRY_ATTEMPT_EVENT = "try_attempt";

/** "Judge" plus four characters of the sandbox chat ID, for example "Judge K3P9". */
export function judgeName(nexconnUserId: string): string {
  const suffix = nexconnUserId.replace(/^try_/, "").slice(0, 4).toUpperCase();
  return `Judge ${suffix || "Guest"}`;
}

/** First hop of x-forwarded-for (set by Vercel), then x-real-ip. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}

/** Keyed hash so stored rate-limit rows never contain a raw IP address. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`try-ip:${ip}`).digest("hex").slice(0, 32);
}
