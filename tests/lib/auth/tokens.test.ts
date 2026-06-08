import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { AuthError } from "@/lib/auth/errors";
import { makeTestToken } from "@/lib/auth/test-helpers";
import { extractToken, verifyToken } from "@/lib/auth/tokens";

async function signWithSecret(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "user-001", role: "provider", email: "test@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret));
}

function authedReq(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("Authorization", authorization);
  return new Request("http://test/me", { headers });
}

describe("extractToken", () => {
  it("throws 401 when the Authorization header is missing", () => {
    expect(() => extractToken(authedReq())).toThrow(AuthError);
    expect(() => extractToken(authedReq())).toThrow("Missing or malformed Authorization header");
  });

  it("throws 401 when the scheme isn't Bearer", () => {
    expect(() => extractToken(authedReq("Basic abc123"))).toThrow(AuthError);
    expect(() => extractToken(authedReq("Basic abc123"))).toThrow(
      "Missing or malformed Authorization header",
    );
  });

  it("returns the raw bearer string", () => {
    expect(extractToken(authedReq("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
  });

  it("throws 401 for an empty bearer value", () => {
    // The Fetch Headers class trims trailing HTTP whitespace on .get(),
    // so "Bearer " is normalized to "Bearer" before extractToken sees it
    // — it fails the "Bearer " prefix check and is rejected right here,
    // rather than reaching verifyToken with an empty string. Either path
    // lands on 401, matching the Python suite's empty-bearer expectation.
    expect(authedReq("Bearer ").headers.get("Authorization")).toBe("Bearer");
    expect(() => extractToken(authedReq("Bearer "))).toThrow(AuthError);
    expect(() => extractToken(authedReq("Bearer "))).toThrow(
      "Missing or malformed Authorization header",
    );
  });
});

describe("verifyToken", () => {
  it("round-trips a validly minted token back to its claims", async () => {
    const token = await makeTestToken({ sub: "user-001", role: "provider", email: "provider@example.com" });
    const claims = await verifyToken(token);
    expect(claims.sub).toBe("user-001");
    expect(claims.role).toBe("provider");
    expect(claims.email).toBe("provider@example.com");
    expect(claims.mfa_verified).toBe(false);
  });

  it("throws 'Token has expired' for an expired token", async () => {
    const token = await makeTestToken({ expired: true });
    await expect(verifyToken(token)).rejects.toThrow(AuthError);
    await expect(verifyToken(token)).rejects.toThrow("Token has expired");
  });

  it("throws 'Invalid token' for a token signed with the wrong secret", async () => {
    const token = await signWithSecret("a-completely-different-secret");
    await expect(verifyToken(token)).rejects.toThrow(AuthError);
    await expect(verifyToken(token)).rejects.toThrow("Invalid token");
  });

  it("throws 'Invalid token' for an empty or malformed token string", async () => {
    await expect(verifyToken("")).rejects.toThrow(AuthError);
    await expect(verifyToken("")).rejects.toThrow("Invalid token");
    await expect(verifyToken("not-a-jwt")).rejects.toThrow("Invalid token");
  });
});
