import { beforeEach, describe, expect, it } from "vitest";

import { clearDenyList } from "@/lib/auth/deny-list";
import { makeTestToken } from "@/lib/auth/test-helpers";
import {
  DUPLICATE_NPI_MESSAGE,
  grantProviderStudyAccess,
  resetDoctorRepositoryForTests,
  upsertDoctorProfile,
} from "@/lib/doctors";

import { GET, POST } from "../../app/api/doctors/route";
import { authedRequest } from "../helpers/request";

beforeEach(() => {
  clearDenyList();
  resetDoctorRepositoryForTests();
});

function jsonRequest(url: string, token: string, body: Record<string, unknown>) {
  return authedRequest(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/doctors", () => {
  it("creates a doctor profile for doctor users", async () => {
    const token = await makeTestToken({ sub: "doctor-user-001", role: "doctor" });
    const res = await POST(jsonRequest("http://test/api/doctors", token, { npi: "1234567890" }));

    expect(res.status).toBe(201);
    expect((await res.json()).data).toMatchObject({
      userId: "doctor-user-001",
      npi: "1234567890",
      subscriptionStatus: "TRIALING",
    });
  });

  it("returns 409 when another doctor already owns the NPI", async () => {
    await upsertDoctorProfile({ userId: "doctor-user-001", npi: "1234567890" });

    const token = await makeTestToken({ sub: "doctor-user-002", role: "doctor" });
    const res = await POST(jsonRequest("http://test/api/doctors", token, { npi: "1234567890" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: DUPLICATE_NPI_MESSAGE });
  });

  it("rejects non-doctor roles", async () => {
    const token = await makeTestToken({ sub: "patient-user-001", role: "patient" });
    const res = await POST(jsonRequest("http://test/api/doctors", token, { npi: "1234567890" }));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/doctors", () => {
  it("returns only explicit provider study grants when subscription permits reading", async () => {
    const doctor = await upsertDoctorProfile({
      userId: "doctor-user-001",
      subscriptionStatus: "ACTIVE",
    });
    await grantProviderStudyAccess({ doctorId: doctor.id, studyId: "study-001" });

    const token = await makeTestToken({ sub: "doctor-user-001", role: "doctor" });
    const res = await GET(authedRequest("http://test/api/doctors", token));

    expect(res.status).toBe(200);
    expect((await res.json()).data.readableStudyIds).toEqual(["study-001"]);
  });

  it("returns zero readable studies for past-due doctors", async () => {
    const doctor = await upsertDoctorProfile({
      userId: "doctor-user-001",
      subscriptionStatus: "PAST_DUE",
    });
    await grantProviderStudyAccess({ doctorId: doctor.id, studyId: "study-001" });

    const token = await makeTestToken({ sub: "doctor-user-001", role: "doctor" });
    const res = await GET(authedRequest("http://test/api/doctors", token));

    expect(res.status).toBe(200);
    expect((await res.json()).data.readableStudyIds).toEqual([]);
  });
});
