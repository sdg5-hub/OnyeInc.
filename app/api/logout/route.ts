import { NextResponse, type NextRequest } from "next/server";

import { addToDenyList, extractToken, getCurrentUser, toErrorResponse } from "@/lib/auth";

/**
 * Revokes the caller's token so it's rejected on subsequent requests —
 * proves extractToken + getCurrentUser + the deny list working together.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const token = extractToken(req);
    addToDenyList(token);
    return NextResponse.json({ message: `Logged out ${user.id} successfully` });
  } catch (err) {
    return toErrorResponse(err);
  }
}
