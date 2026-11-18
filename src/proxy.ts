import { NextResponse } from "next/server";

// Session refresh and route protection will be added in Phase 3.
export function proxy() {
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/onboarding"] };
