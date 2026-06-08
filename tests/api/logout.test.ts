import { beforeEach, describe, expect, it } from "vitest";

import { clearDenyList } from "@/lib/auth/deny-list";
import { makeTestToken } from "@/lib/auth/test-helpers";

import { GET as me } from "../../app/api/me/route";
import { POST as logout } from "../../app/api/logout/route";
import { authedRequest } from "../helpers/request";

beforeEach(() => {
  clearDenyList();
});

describe("POST /api/logout", () => {
  it("returns 401 when no Authorization header is sent", async () => {
    const res = await logout(authedRequest("http://test/api/logout", undefined, { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("revokes the token: logout succeeds, then /api/me rejects it as revoked", async () => {
    const token = await makeTestToken({ sub: "user-001" });

    const logoutRes = await logout(authedRequest("http://test/api/logout", token, { method: "POST" }));
    expect(logoutRes.status).toBe(200);
    expect((await logoutRes.json()).message).toContain("user-001");

    const meRes = await me(authedRequest("http://test/api/me", token));
    expect(meRes.status).toBe(401);
    expect((await meRes.json()).detail).toContain("revoked");
  });

  it("returns 401 with a 'revoked' detail the second time the same token is logged out", async () => {
    const token = await makeTestToken();

    const first = await logout(authedRequest("http://test/api/logout", token, { method: "POST" }));
    expect(first.status).toBe(200);

    const second = await logout(authedRequest("http://test/api/logout", token, { method: "POST" }));
    expect(second.status).toBe(401);
    expect((await second.json()).detail).toContain("revoked");
  });
});
