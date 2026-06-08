import { beforeEach, describe, expect, it } from "vitest";

import { clearDenyList } from "@/lib/auth/deny-list";
import { makeTestToken } from "@/lib/auth/test-helpers";

import { GET as clinical } from "../../app/api/clinical/route";
import { GET as providerOnly } from "../../app/api/provider-only/route";
import { authedRequest } from "../helpers/request";

beforeEach(() => {
  clearDenyList();
});

describe("GET /api/provider-only", () => {
  it("returns 200 for a provider", async () => {
    const token = await makeTestToken({ role: "provider" });
    const res = await providerOnly(authedRequest("http://test/api/provider-only", token));
    expect(res.status).toBe(200);
  });

  it("returns 403 for a non-provider role", async () => {
    const token = await makeTestToken({ role: "patient" });
    const res = await providerOnly(authedRequest("http://test/api/provider-only", token));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/clinical", () => {
  it("returns 200 for providers and doctors", async () => {
    const providerToken = await makeTestToken({ role: "provider" });
    const doctorToken = await makeTestToken({ role: "doctor" });

    const providerRes = await clinical(authedRequest("http://test/api/clinical", providerToken));
    const doctorRes = await clinical(authedRequest("http://test/api/clinical", doctorToken));

    expect(providerRes.status).toBe(200);
    expect(doctorRes.status).toBe(200);
  });

  it("returns 403 for roles outside the allow-list", async () => {
    const patientToken = await makeTestToken({ role: "patient" });
    const insurerToken = await makeTestToken({ role: "insurer" });

    const patientRes = await clinical(authedRequest("http://test/api/clinical", patientToken));
    const insurerRes = await clinical(authedRequest("http://test/api/clinical", insurerToken));

    expect(patientRes.status).toBe(403);
    expect(insurerRes.status).toBe(403);
  });
});
