import "server-only";

import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";

export function supabaseWithCookies(cookieMethods: CookieMethodsServer) {
  const { url, key } = supabasePublicConfig();
  return createServerClient(url, key, { cookies: cookieMethods });
}

export async function serverSupabase() {
  const store = await cookies();
  return supabaseWithCookies({
    getAll: () => store.getAll(),
    setAll(values) {
      try {
        for (const { name, value, options } of values) store.set(name, value, options);
      } catch {
        // Server Components cannot write cookies. The proxy persists refreshes.
      }
    },
  });
}
