export type DoctorSubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type DoctorRecipientType = "PROVIDER";

export interface DoctorProfile {
  id: string;
  userId: string;
  npi: string | null;
  specialty: string | null;
  facilityName: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeStatusRaw: string | null;
  subscriptionStatus: DoctorSubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionCanceledAt: Date | null;
  npiVerifiedAt: Date | null;
  npiVerificationSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorStudyShare {
  doctorId: string;
  studyId: string;
  recipientType: DoctorRecipientType;
  grantedByUserId: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
}

export interface UpsertDoctorProfileInput {
  userId: string;
  npi?: string | null;
  specialty?: string | null;
  facilityName?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeStatusRaw?: string | null;
  subscriptionStatus?: DoctorSubscriptionStatus;
  trialEndsAt?: Date | null;
  subscriptionCanceledAt?: Date | null;
  npiVerifiedAt?: Date | null;
  npiVerificationSource?: string | null;
}

export interface GrantProviderStudyAccessInput {
  doctorId: string;
  studyId: string;
  grantedByUserId?: string | null;
}

export interface DoctorAccessSummary {
  doctor: DoctorProfile;
  canReadSharedStudies: boolean;
  canMutateSharedStudies: boolean;
  readableStudyIds: string[];
}
