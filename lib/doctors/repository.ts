import { readableProviderStudyIds, hasDoctorReadAccess, hasDoctorWriteAccess } from "./access";
import { DuplicateNpiError } from "./errors";
import type {
  DoctorAccessSummary,
  DoctorProfile,
  DoctorStudyShare,
  GrantProviderStudyAccessInput,
  UpsertDoctorProfileInput,
} from "./types";

const doctorsByUserId = new Map<string, DoctorProfile>();
const doctorSharesByDoctorId = new Map<string, DoctorStudyShare[]>();

function normalizeOptionalString(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function findDoctorByNpi(npi: string, exceptUserId: string) {
  return Array.from(doctorsByUserId.values()).find(
    (doctor) => doctor.npi === npi && doctor.userId !== exceptUserId,
  );
}

export async function upsertDoctorProfile(input: UpsertDoctorProfileInput): Promise<DoctorProfile> {
  const npi = normalizeOptionalString(input.npi);

  if (npi && findDoctorByNpi(npi, input.userId)) {
    throw new DuplicateNpiError();
  }

  const existingDoctor = doctorsByUserId.get(input.userId);
  const now = new Date();
  const doctor: DoctorProfile = {
    id: existingDoctor?.id ?? makeId("doc"),
    userId: input.userId,
    npi: npi !== undefined ? npi : existingDoctor?.npi ?? null,
    specialty:
      input.specialty !== undefined
        ? normalizeOptionalString(input.specialty) ?? null
        : existingDoctor?.specialty ?? null,
    facilityName:
      input.facilityName !== undefined
        ? normalizeOptionalString(input.facilityName) ?? null
        : existingDoctor?.facilityName ?? null,
    stripeCustomerId:
      input.stripeCustomerId !== undefined
        ? normalizeOptionalString(input.stripeCustomerId) ?? null
        : existingDoctor?.stripeCustomerId ?? null,
    stripeSubscriptionId:
      input.stripeSubscriptionId !== undefined
        ? normalizeOptionalString(input.stripeSubscriptionId) ?? null
        : existingDoctor?.stripeSubscriptionId ?? null,
    stripePriceId:
      input.stripePriceId !== undefined
        ? normalizeOptionalString(input.stripePriceId) ?? null
        : existingDoctor?.stripePriceId ?? null,
    stripeStatusRaw:
      input.stripeStatusRaw !== undefined
        ? normalizeOptionalString(input.stripeStatusRaw) ?? null
        : existingDoctor?.stripeStatusRaw ?? null,
    subscriptionStatus: input.subscriptionStatus ?? existingDoctor?.subscriptionStatus ?? "TRIALING",
    trialEndsAt: input.trialEndsAt !== undefined ? input.trialEndsAt : existingDoctor?.trialEndsAt ?? null,
    subscriptionCanceledAt:
      input.subscriptionCanceledAt !== undefined
        ? input.subscriptionCanceledAt
        : existingDoctor?.subscriptionCanceledAt ?? null,
    npiVerifiedAt:
      input.npiVerifiedAt !== undefined ? input.npiVerifiedAt : existingDoctor?.npiVerifiedAt ?? null,
    npiVerificationSource:
      input.npiVerificationSource !== undefined
        ? normalizeOptionalString(input.npiVerificationSource) ?? null
        : existingDoctor?.npiVerificationSource ?? null,
    createdAt: existingDoctor?.createdAt ?? now,
    updatedAt: now,
  };

  doctorsByUserId.set(input.userId, doctor);
  return doctor;
}

export async function grantProviderStudyAccess(input: GrantProviderStudyAccessInput): Promise<DoctorStudyShare> {
  const existingShares = doctorSharesByDoctorId.get(input.doctorId) ?? [];
  const existingShare = existingShares.find((share) => share.studyId === input.studyId);

  const share: DoctorStudyShare = {
    doctorId: input.doctorId,
    studyId: input.studyId,
    recipientType: "PROVIDER",
    grantedByUserId: normalizeOptionalString(input.grantedByUserId) ?? null,
    grantedAt: new Date(),
    revokedAt: null,
  };

  if (existingShare) {
    Object.assign(existingShare, share);
  } else {
    existingShares.push(share);
  }

  doctorSharesByDoctorId.set(input.doctorId, existingShares);
  return share;
}

export async function getDoctorAccessSummary(userId: string): Promise<DoctorAccessSummary | null> {
  const doctor = doctorsByUserId.get(userId);

  if (!doctor) {
    return null;
  }

  const shares = doctorSharesByDoctorId.get(doctor.id) ?? [];

  return {
    doctor,
    canReadSharedStudies: hasDoctorReadAccess(doctor),
    canMutateSharedStudies: hasDoctorWriteAccess(doctor),
    readableStudyIds: readableProviderStudyIds(doctor, shares),
  };
}

export async function updateDoctorByStripeSubscription(
  stripeCustomerId: string | undefined,
  stripeSubscriptionId: string | undefined,
  updates: Omit<Partial<UpsertDoctorProfileInput>, "userId">,
) {
  const doctor = Array.from(doctorsByUserId.values()).find(
    (candidate) =>
      (stripeCustomerId && candidate.stripeCustomerId === stripeCustomerId) ||
      (stripeSubscriptionId && candidate.stripeSubscriptionId === stripeSubscriptionId),
  );

  if (!doctor) {
    return false;
  }

  await upsertDoctorProfile({
    ...updates,
    userId: doctor.userId,
    stripeCustomerId: updates.stripeCustomerId ?? stripeCustomerId ?? doctor.stripeCustomerId,
    stripeSubscriptionId: updates.stripeSubscriptionId ?? stripeSubscriptionId ?? doctor.stripeSubscriptionId,
  });

  return true;
}

export function resetDoctorRepositoryForTests() {
  doctorsByUserId.clear();
  doctorSharesByDoctorId.clear();
}
