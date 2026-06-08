import { NextResponse } from "next/server";

/** Unauthenticated liveness check — proves the app is up, nothing more. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
