export const PRESENCE_TTL_MS = 30_000;
const LOOKUP_CONCURRENCY = 10;

type Entry = { online: boolean; expires: number };
type Lookup = (userId: string) => Promise<boolean>;

// Nexconn checks one user per call (100 per second), so lookups are cached and run in small batches.
export function createPresenceCache(lookup: Lookup, now: () => number = Date.now) {
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<boolean | null>>();

  function fetchOne(userId: string) {
    const existing = inflight.get(userId);
    if (existing) return existing;
    const request = lookup(userId)
      .then((online) => {
        entries.set(userId, { online, expires: now() + PRESENCE_TTL_MS });
        return online;
      })
      .catch(() => null)
      .finally(() => inflight.delete(userId));
    inflight.set(userId, request);
    return request;
  }

  async function onlineStatus(userIds: readonly string[]): Promise<Map<string, boolean | null>> {
    const result = new Map<string, boolean | null>();
    const stale: string[] = [];
    for (const userId of new Set(userIds)) {
      const cached = entries.get(userId);
      if (cached && cached.expires > now()) result.set(userId, cached.online);
      else stale.push(userId);
    }
    for (let offset = 0; offset < stale.length; offset += LOOKUP_CONCURRENCY) {
      const batch = stale.slice(offset, offset + LOOKUP_CONCURRENCY);
      const values = await Promise.all(batch.map(fetchOne));
      batch.forEach((userId, index) => result.set(userId, values[index]));
    }
    return result;
  }

  return { onlineStatus };
}
