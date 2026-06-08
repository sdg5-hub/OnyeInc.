import { NextResponse } from "next/server";

/**
 * Thrown by lib/auth functions on auth failure. Next.js has no
 * exception-to-response translation like FastAPI's HTTPException —
 * route handlers must catch AuthError and convert it explicitly,
 * which toErrorResponse does.
 */
export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ detail: err.message }, { status: err.status });
  }
  throw err;
}
