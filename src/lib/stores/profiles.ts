import { create } from "zustand";

export type ChatProfile = { name: string; avatar: string | null; role: string; dept: string | null; year: number | null };

export const useProfiles = create<{ profiles: Record<string, ChatProfile | null> }>(() => ({ profiles: {} }));
const inflight = new Map<string, symbol>();
const retryAfter = new Map<string, number>();

export function resetProfiles() {
  inflight.clear();
  retryAfter.clear();
  useProfiles.setState({ profiles: {} });
}

export async function loadProfiles(ids: readonly string[]) {
  const current = useProfiles.getState().profiles;
  const missing = [...new Set(ids)].filter((id) => /^[a-z0-9_]{1,64}$/.test(id)
    && !Object.hasOwn(current, id) && !inflight.has(id) && (retryAfter.get(id) ?? 0) <= Date.now());
  const request = Symbol();
  for (const id of missing) inflight.set(id, request);
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100).filter((id) => inflight.get(id) === request);
    if (!batch.length) continue;
    try {
      const query = new URLSearchParams({ ids: batch.join(",") });
      const response = await fetch(`/api/profiles?${query}`);
      if (!response.ok) throw new Error("Profiles unavailable");
      const { profiles } = await response.json() as { profiles: Record<string, ChatProfile> };
      const additions = batch.filter((id) => inflight.get(id) === request).map((id) =>
        [id, Object.hasOwn(profiles, id) ? profiles[id] : null]);
      useProfiles.setState((state) => ({ profiles: { ...state.profiles, ...Object.fromEntries(additions) } }));
    } catch {
      for (const id of batch) if (inflight.get(id) === request) retryAfter.set(id, Date.now() + 15_000);
    } finally {
      for (const id of batch) if (inflight.get(id) === request) inflight.delete(id);
    }
  }
}
