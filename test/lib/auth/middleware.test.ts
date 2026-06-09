import { beforeEach, describe, expect, it } from "vitest";

import { addToDenyList, clearDenyList } from "@/lib/auth/deny-list";
import { AuthError } from "@/lib/auth/errors";
import { getCurrentUser, requireRole } from "@/lib/auth/middleware";
import { makeRawTestToken, makeTestToken } from "@/lib/auth/test-helpers";

import { authedRequest } from "../../helpers/request";

beforeEach(() => {
  clearDenyList();
});

async function expectAuthError(promise: Promise<unknown>, status: 401 | 403, messageContains: string) {
  await expect(promise).rejects.toMatchObject(
    expect.objectContaining({ status, message: expect.stringContaining(messageContains) }),
  );
}

describe("getCurrentUser", () => {
  it("returns the AuthUser fields decoded from a valid token", async () => {
    const token = await makeTestToken({ sub: "user-001", role: "provider", email: "provider@example.com" });
    const user = await getCurrentUser(authedRequest("http://test/me", token));
    expect(user).toEqual({
      id: "user-001",
      role: "provider",
      email: "provider@example.com",
      mfaVerified: false,
    });
  });

  it("throws 401 when the Authorization header is missing or malformed", async () => {
    await expectAuthError(
      getCurrentUser(authedRequest("http://test/me")),
      401,
      "Missing or malformed Authorization header",
    );
  });

  it("throws 'Token has expired' for an expired token", async () => {
    const token = await makeTestToken({ expired: true });
    await expectAuthError(getCurrentUser(authedRequest("http://test/me", token)), 401, "expired");
  });

  it("throws 'Token has been revoked' for a denied token", async () => {
    const token = await makeTestToken();
    addToDenyList(token);
    await expectAuthError(getCurrentUser(authedRequest("http://test/me", token)), 401, "revoked");
  });

  it("still authenticates a non-denied token when another token is denied", async () => {
    const tokenA = await makeTestToken({ sub: "user-a" });
    const tokenB = await makeTestToken({ sub: "user-b" });
    addToDenyList(tokenA);

    const user = await getCurrentUser(authedRequest("http://test/me", tokenB));
    expect(user.id).toBe("user-b");
  });

  it("falls back to app_metadata.role when the top-level role claim is absent", async () => {
    const token = await makeRawTestToken({
      sub: "u1",
      app_metadata: { role: "doctor" },
      email: "doctor@example.com",
    });
    const user = await getCurrentUser(authedRequest("http://test/me", token));
    expect(user.role).toBe("doctor");
  });

  it("throws 'Token missing role claim' when no role is present anywhere", async () => {
    const token = await makeRawTestToken({ sub: "u1", email: "test@example.com" });
    await expectAuthError(
      getCurrentUser(authedRequest("http://test/me", token)),
      401,
      "Token missing role claim",
    );
  });

  it("throws 'Token missing subject claim' when sub is absent", async () => {
    const token = await makeRawTestToken({ role: "provider", email: "test@example.com" });
    await expectAuthError(
      getCurrentUser(authedRequest("http://test/me", token)),
      401,
      "Token missing subject claim",
    );
  });

  it("blocks an imaging_tech user without MFA verification (403)", async () => {
    const token = await makeTestToken({ role: "imaging_tech", mfaVerified: false });
    await expectAuthError(
      getCurrentUser(authedRequest("http://test/me", token)),
      403,
      "MFA verification required for Imaging Tech users",
    );
  });

  it("allows an imaging_tech user once MFA is verified", async () => {
    const token = await makeTestToken({ role: "imaging_tech", mfaVerified: true });
    const user = await getCurrentUser(authedRequest("http://test/me", token));
    expect(user.role).toBe("imaging_tech");
    expect(user.mfaVerified).toBe(true);
  });

  it("does not gate non-imaging_tech roles on MFA", async () => {
    const token = await makeTestToken({ role: "provider", mfaVerified: false });
    const user = await getCurrentUser(authedRequest("http://test/me", token));
    expect(user.role).toBe("provider");
  });
});

describe("requireRole", () => {
  it("allows a user whose role matches the single allowed role", async () => {
    const token = await makeTestToken({ role: "provider" });
    const user = await requireRole("provider")(authedRequest("http://test/provider-only", token));
    expect(user.role).toBe("provider");
  });

  it("blocks a user whose role doesn't match (403)", async () => {
    const token = await makeTestToken({ role: "patient" });
    await expectAuthError(
      requireRole("provider")(authedRequest("http://test/provider-only", token)),
      403,
      "is not permitted for this endpoint",
    );
  });

  it("allows any role from a multi-role guard", async () => {
    const providerToken = await makeTestToken({ role: "provider" });
    const doctorToken = await makeTestToken({ role: "doctor" });
    const guard = requireRole("provider", "doctor");

    await expect(guard(authedRequest("http://test/clinical", providerToken))).resolves.toMatchObject({
      role: "provider",
    });
    await expect(guard(authedRequest("http://test/clinical", doctorToken))).resolves.toMatchObject({
      role: "doctor",
    });
  });

  it("blocks roles not present in a multi-role guard's allow-list", async () => {
    const patientToken = await makeTestToken({ role: "patient" });
    const insurerToken = await makeTestToken({ role: "insurer" });
    const guard = requireRole("provider", "doctor");

    await expectAuthError(guard(authedRequest("http://test/clinical", patientToken)), 403, "not permitted");
    await expectAuthError(guard(authedRequest("http://test/clinical", insurerToken)), 403, "not permitted");
  });

  it("propagates 401s from getCurrentUser before evaluating the role guard", async () => {
    const token = await makeTestToken({ role: "provider" });
    addToDenyList(token);

    await expectAuthError(
      requireRole("provider")(authedRequest("http://test/provider-only", token)),
      401,
      "revoked",
    );
  });
});

describe("AuthError", () => {
  it("is the type thrown across the auth pipeline", async () => {
    try {
      await getCurrentUser(authedRequest("http://test/me"));
      expect.unreachable("getCurrentUser should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
    }
  });
});
