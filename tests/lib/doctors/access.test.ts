import { describe, expect, it } from "vitest";

import { hasDoctorReadAccess, hasDoctorWriteAccess, readableProviderStudyIds } from "@/lib/doctors";
import type { DoctorProfile, DoctorStudyShare } from "@/lib/doctors";

function doctor(overrides: Partial<DoctorProfile>): DoctorProfile {
  const now = new Date("2026-06-08T12:00:00.000Z");

  return {
    id: "doc-001",
    userId: "user-001",
    npi: null,
    specialty: null,
    facilityName: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeStatusRaw: null,
    subscriptionStatus: "ACTIVE",
    trialEndsAt: null,
    subscriptionCanceledAt: null,
    npiVerifiedAt: null,
    npiVerificationSource: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function share(overrides: Partial<DoctorStudyShare>): DoctorStudyShare {
  return {
    doctorId: "doc-001",
    studyId: "study-001",
    recipientType: "PROVIDER",
    grantedByUserId: null,
    grantedAt: new Date("2026-06-08T12:00:00.000Z"),
    revokedAt: null,
    ...overrides,
  };
}

describe("DOC-000 doctor access rules", () => {
  it("allows active and trialing doctors to read/write explicit provider shares", () => {
    expect(hasDoctorReadAccess(doctor({ subscriptionStatus: "ACTIVE" }))).toBe(true);
    expect(hasDoctorWriteAccess(doctor({ subscriptionStatus: "ACTIVE" }))).toBe(true);
    expect(hasDoctorReadAccess(doctor({ subscriptionStatus: "TRIALING" }))).toBe(true);
    expect(hasDoctorWriteAccess(doctor({ subscriptionStatus: "TRIALING" }))).toBe(true);
  });

  it("returns zero studies for past due doctors", () => {
    const pastDueDoctor = doctor({ subscriptionStatus: "PAST_DUE" });

    expect(hasDoctorReadAccess(pastDueDoctor)).toBe(false);
    expect(hasDoctorWriteAccess(pastDueDoctor)).toBe(false);
    expect(readableProviderStudyIds(pastDueDoctor, [share({ studyId: "study-001" })])).toEqual([]);
  });

  it("allows canceled doctors to read only during the 30-day grace period", () => {
    const now = new Date("2026-06-08T12:00:00.000Z");
    const canceledInsideGrace = doctor({
      subscriptionStatus: "CANCELED",
      subscriptionCanceledAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    const canceledExpired = doctor({
      subscriptionStatus: "CANCELED",
      subscriptionCanceledAt: new Date("2026-04-20T12:00:00.000Z"),
    });

    expect(hasDoctorReadAccess(canceledInsideGrace, now)).toBe(true);
    expect(hasDoctorWriteAccess(canceledInsideGrace)).toBe(false);
    expect(hasDoctorReadAccess(canceledExpired, now)).toBe(false);
  });

  it("only returns active explicit provider shares", () => {
    const activeDoctor = doctor({ subscriptionStatus: "ACTIVE" });
    const studyIds = readableProviderStudyIds(activeDoctor, [
      share({ studyId: "study-active" }),
      share({ studyId: "study-revoked", revokedAt: new Date("2026-06-08T12:00:00.000Z") }),
    ]);

    expect(studyIds).toEqual(["study-active"]);
  });
});
