import type { DoctorProfile, DoctorStudyShare } from "./types";

const CANCELED_READ_ONLY_GRACE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DoctorAccessFields = Pick<DoctorProfile, "subscriptionStatus" | "subscriptionCanceledAt">;

export function hasDoctorReadAccess(doctor: DoctorAccessFields, now = new Date()) {
  if (doctor.subscriptionStatus === "TRIALING" || doctor.subscriptionStatus === "ACTIVE") {
    return true;
  }

  if (doctor.subscriptionStatus === "CANCELED" && doctor.subscriptionCanceledAt) {
    const gracePeriodEndsAt = new Date(
      doctor.subscriptionCanceledAt.getTime() + CANCELED_READ_ONLY_GRACE_DAYS * MS_PER_DAY,
    );
    return gracePeriodEndsAt >= now;
  }

  return false;
}

export function hasDoctorWriteAccess(doctor: DoctorAccessFields) {
  return doctor.subscriptionStatus === "TRIALING" || doctor.subscriptionStatus === "ACTIVE";
}

export function isExplicitActiveProviderShare(share: Pick<DoctorStudyShare, "recipientType" | "revokedAt">) {
  return share.recipientType === "PROVIDER" && share.revokedAt === null;
}

export function readableProviderStudyIds(
  doctor: DoctorAccessFields,
  shares: Array<Pick<DoctorStudyShare, "studyId" | "recipientType" | "revokedAt">>,
  now = new Date(),
) {
  if (!hasDoctorReadAccess(doctor, now)) {
    return [];
  }

  return shares.filter(isExplicitActiveProviderShare).map((share) => share.studyId);
}
