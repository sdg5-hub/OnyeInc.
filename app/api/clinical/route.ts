import { NextResponse, type NextRequest } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth";

/** Returns 200 for providers and doctors — patients and insurers get 403. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("provider", "doctor")(req);
    return NextResponse.json({ message: `Hello ${user.role} ${user.id}` });
  } catch (err) {
    return toErrorResponse(err);
  }
}
