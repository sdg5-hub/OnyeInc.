import { beforeEach, describe, expect, it } from "vitest";

import { addToDenyList, clearDenyList } from "@/lib/auth/deny-list";
import { makeTestToken } from "@/lib/auth/test-helpers";

import { middleware } from "../middleware";
import { authedRequest } from "./helpers/request";

beforeEach(() => {
  clearDenyList();
});

function isPassThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

describe("middleware", () => {
  it("passes /api/health through without requiring a token", async () => {
    const res = await middleware(authedRequest("http://test/api/health"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("passes through a protected path when the bearer token is valid", async () => {
    const token = await makeTestToken({ role: "provider" });
    const res = await middleware(authedRequest("http://test/api/me", token));
    expect(isPassThrough(res)).toBe(true);
  });

  it("rejects a protected path with 401 when no token is present", async () => {
    const res = await middleware(authedRequest("http://test/api/me"));
    expect(res.status).toBe(401);
    expect(isPassThrough(res)).toBe(false);
  });

  it("rejects a protected path with 401 for a revoked token", async () => {
    const token = await makeTestToken();
    addToDenyList(token);
    const res = await middleware(authedRequest("http://test/api/me", token));
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toContain("revoked");
  });

  it("rejects a protected path with 403 for an unverified imaging_tech token", async () => {
    const token = await makeTestToken({ role: "imaging_tech", mfaVerified: false });
    const res = await middleware(authedRequest("http://test/api/clinical", token));
    expect(res.status).toBe(403);
    expect((await res.json()).detail).toContain("MFA");
  });
});
