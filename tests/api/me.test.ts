import { beforeEach, describe, expect, it } from "vitest";

import { addToDenyList, clearDenyList } from "@/lib/auth/deny-list";
import { makeTestToken } from "@/lib/auth/test-helpers";

import { GET as health } from "../../app/api/health/route";
import { GET as me } from "../../app/api/me/route";
import { authedRequest } from "../helpers/request";

beforeEach(() => {
  clearDenyList();
});

describe("GET /api/health", () => {
  it("returns 200 with status ok, unauthenticated", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/me", () => {
  it("returns 401 when no Authorization header is sent", async () => {
    const res = await me(authedRequest("http://test/api/me"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with the decoded user fields for a valid token", async () => {
    const token = await makeTestToken({ sub: "user-001", role: "provider", email: "provider@example.com" });
    const res = await me(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "user-001",
      role: "provider",
      email: "provider@example.com",
      mfa_verified: false,
    });
  });

  it("returns 401 with an 'expired' detail for an expired token", async () => {
    const token = await makeTestToken({ expired: true });
    const res = await me(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toContain("expired");
  });

  it("returns 401 with a 'revoked' detail for a denied token", async () => {
    const token = await makeTestToken();
    addToDenyList(token);
    const res = await me(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toContain("revoked");
  });

  it("returns 403 with an 'MFA' detail for imaging_tech without MFA", async () => {
    const token = await makeTestToken({ role: "imaging_tech", mfaVerified: false });
    const res = await me(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(403);
    expect((await res.json()).detail).toContain("MFA");
  });

  it("returns 200 for imaging_tech once MFA is verified", async () => {
    const token = await makeTestToken({ role: "imaging_tech", mfaVerified: true });
    const res = await me(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(200);
  });
});
