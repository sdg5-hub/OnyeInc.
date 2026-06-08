import { NextResponse, type NextRequest } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth";

/** Returns 200 only for providers — all other roles get 403. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("provider")(req);
    return NextResponse.json({ message: `Hello provider ${user.id}` });
  } catch (err) {
    return toErrorResponse(err);
  }
}
