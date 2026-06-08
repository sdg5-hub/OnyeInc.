import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, toErrorResponse } from "@/lib/auth";

/** Returns the authenticated caller's profile — proves getCurrentUser end-to-end. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    return NextResponse.json({
      id: user.id,
      role: user.role,
      email: user.email,
      mfa_verified: user.mfaVerified,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
