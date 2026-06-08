import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, toErrorResponse } from "@/lib/auth";

const PUBLIC_PATHS = ["/api/health"];

/**
 * Thin edge-level gate: every /api/* route except the public ones above
 * must carry a valid bearer token. This is coarse-grained — it only proves
 * a token verifies; per-route role and MFA checks still live in
 * lib/auth/middleware.ts (requireRole, the imaging_tech gate) and are
 * enforced again by each route handler. Kept deliberately thin so this
 * file's own test stays thin — the bulk of auth-logic coverage belongs to
 * lib/auth/middleware.test.ts.
 */
export async function middleware(req: NextRequest) {
  if (PUBLIC_PATHS.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  try {
    await getCurrentUser(req);
    return NextResponse.next();
  } catch (err) {
    return toErrorResponse(err);
  }
}

export const config = {
  matcher: "/api/:path*",
};
