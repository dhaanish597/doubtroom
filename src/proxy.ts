import { NextResponse, type NextRequest } from "next/server";

import { requestOrigin } from "@/lib/request-origin";
import { supabaseWithCookies } from "@/lib/supabase/server";
import { TRY_COOKIE_NAME, verifyTryCookie } from "@/lib/auth/try-cookie";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = supabaseWithCookies({
    getAll: () => request.cookies.getAll(),
    setAll(values, headers) {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) response.cookies.set(name, value, options);
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    },
  });
  const { data } = await supabase.auth.getClaims();
  const onApp = request.nextUrl.pathname === "/app" || request.nextUrl.pathname.startsWith("/app/");
  const allowedTry = !data?.claims?.sub && onApp
    && await verifyTryCookie(request.cookies.get(TRY_COOKIE_NAME)?.value);

  if (data?.claims?.sub || allowedTry) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const redirect = NextResponse.redirect(new URL("/login", requestOrigin(request)));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export const config = { matcher: ["/app/:path*", "/onboarding"] };
