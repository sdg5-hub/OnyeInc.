import { describe, expect, it, vi } from "vitest";

import {
  buildPatientSmsBody,
  hashPatientPhone,
  NO_PHONE_WARNING,
  normalizePatientPhone,
  processPatientSmsNotification,
  type DashboardWarning,
  type PatientSmsRepository,
  type SmsAuditEvent,
  type SmsClaimResult,
  type SmsProvider,
  type SmsProcessStatus,
  type StructuredSmsError,
  type StudySmsContext,
} from "@/lib/patient-sms";

const STUDY_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-06-12T12:00:00.000Z");

describe("PAT-101 SMS service", () => {
  it("builds the exact required SMS body", () => {
    expect(
      buildPatientSmsBody({
        facilityName: "Onye Imaging",
        token: "token_abc",
        expiresInDays: 7,
      }),
    ).toBe(
      "Your imaging study from Onye Imaging is ready. View it securely: https://app.onyesync.com/v/token_abc — This link expires in 7 days.",
    );
  });

  it("normalizes US phone numbers to E.164 and hashes the normalized value", () => {
    const phone = normalizePatientPhone("(212) 555-0100");

    expect(phone).toBe("+12125550100");
    expect(hashPatientPhone(phone)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPatientPhone(phone)).not.toContain("212");
  });

  it("sends one Twilio SMS, writes a sent audit event, and stores only the phone hash", async () => {
    const repository = new FakePatientSmsRepository(baseContext());
    const smsProvider = new FakeSmsProvider();

    const result = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(result).toEqual({
      status: "sent",
      studyId: STUDY_ID,
      twilioMessageSid: "SM_TEST_1",
    });
    expect(smsProvider.messages).toEqual([
      {
        to: "+12125550100",
        body: "Your imaging study from Onye Imaging is ready. View it securely: https://app.onyesync.com/v/share_token_256_bit — This link expires in 7 days.",
      },
    ]);
    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]).toMatchObject({
      eventType: "SMS_NOTIFICATION_SENT",
      studyId: STUDY_ID,
      twilioMessageSid: "SM_TEST_1",
      failureReason: null,
    });
    expect(repository.auditEvents[0].recipientPhoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.auditEvents[0].recipientPhoneHash).not.toContain("212");
    expect(repository.structuredErrors).toEqual([]);
    expect(repository.dashboardWarnings).toEqual([]);
  });

  it("suppresses a duplicate COMPLETE trigger after a successful send", async () => {
    const repository = new FakePatientSmsRepository(baseContext());
    const smsProvider = new FakeSmsProvider();

    await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });
    const duplicate = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(duplicate).toEqual({
      status: "suppressed",
      studyId: STUDY_ID,
      reason: "ALREADY_SENT",
    });
    expect(smsProvider.messages).toHaveLength(1);
    expect(repository.auditEvents.filter((event) => event.eventType === "SMS_NOTIFICATION_SENT")).toHaveLength(1);
  });

  it("skips Twilio and persists the exact dashboard warning when phone is missing", async () => {
    const repository = new FakePatientSmsRepository({ ...baseContext(), patientPhone: null });
    const smsProvider = new FakeSmsProvider();

    const result = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(result).toEqual({
      status: "failed",
      studyId: STUDY_ID,
      reason: "NO_PHONE_ON_FILE",
    });
    expect(smsProvider.messages).toEqual([]);
    expect(repository.auditEvents[0]).toMatchObject({
      eventType: "SMS_NOTIFICATION_FAILED",
      studyId: STUDY_ID,
      recipientPhoneHash: null,
      failureReason: "NO_PHONE_ON_FILE",
    });
    expect(repository.dashboardWarnings).toEqual([
      {
        studyId: STUDY_ID,
        code: "NO_PHONE_ON_FILE",
        message: NO_PHONE_WARNING,
      },
    ]);
  });

  it("handles invalid phone numbers with safe structured errors and no Twilio call", async () => {
    const repository = new FakePatientSmsRepository({ ...baseContext(), patientPhone: "not a phone" });
    const smsProvider = new FakeSmsProvider();

    const result = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("INVALID_PATIENT_PHONE");
    expect(smsProvider.messages).toEqual([]);
    expect(repository.structuredErrors[0]).toMatchObject({
      component: "PAT-101",
      studyId: STUDY_ID,
      errorCode: "INVALID_PATIENT_PHONE",
      errorType: "PHONE_NORMALIZATION_FAILED",
      safeMessage: "Patient phone could not be normalized to E.164.",
    });
    expect(JSON.stringify(repository.structuredErrors)).not.toContain("not a phone");
  });

  it("catches Twilio failures and records a failed audit event without throwing", async () => {
    const repository = new FakePatientSmsRepository(baseContext());
    const smsProvider = new FakeSmsProvider("failed");

    const result = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(result).toEqual({
      status: "failed",
      studyId: STUDY_ID,
      reason: "TWILIO_API_ERROR",
    });
    expect(repository.auditEvents[0]).toMatchObject({
      eventType: "SMS_NOTIFICATION_FAILED",
      studyId: STUDY_ID,
      failureReason: "TWILIO_API_ERROR",
      twilioMessageSid: null,
    });
    expect(repository.structuredErrors[0]).toMatchObject({
      errorCode: "TWILIO_API_ERROR",
      errorType: "SMS_PROVIDER_FAILURE",
      safeMessage: "Twilio message creation failed.",
    });
    expect(repository.notificationStatus).toBe("FAILED");
  });

  it("does not call Twilio when another request already claimed the automatic attempt", async () => {
    const repository = new FakePatientSmsRepository(baseContext());
    repository.nextClaim = { status: "ALREADY_ATTEMPTED" };
    const smsProvider = new FakeSmsProvider();

    const result = await processPatientSmsNotification({
      studyId: STUDY_ID,
      repository,
      smsProvider,
      now: NOW,
    });

    expect(result).toEqual({
      status: "suppressed",
      studyId: STUDY_ID,
      reason: "ALREADY_ATTEMPTED",
    });
    expect(smsProvider.messages).toEqual([]);
  });
});

function baseContext(): StudySmsContext {
  return {
    studyId: STUDY_ID,
    facilityName: "Onye Imaging",
    patientPhone: "212-555-0100",
    shareToken: "share_token_256_bit",
    expiresInDays: 7,
  };
}

class FakeSmsProvider implements SmsProvider {
  readonly messages: Array<{ to: string; body: string }> = [];

  constructor(private readonly mode: "ok" | "failed" = "ok") {}

  async sendSms(input: { to: string; body: string }) {
    this.messages.push(input);
    if (this.mode === "failed") {
      throw new Error("Twilio request failed with +12125550100");
    }
    return { messageSid: `SM_TEST_${this.messages.length}` };
  }
}

class FakePatientSmsRepository implements PatientSmsRepository {
  readonly auditEvents: SmsAuditEvent[] = [];
  readonly structuredErrors: StructuredSmsError[] = [];
  readonly dashboardWarnings: DashboardWarning[] = [];
  nextClaim: SmsClaimResult | null = null;
  notificationStatus: SmsProcessStatus | "SENDING" | null = null;

  constructor(private readonly context: StudySmsContext | null) {}

  async getStudySmsContext() {
    return this.context;
  }

  async hasSuccessfulSmsNotification() {
    return this.notificationStatus === "sent";
  }

  async claimSmsNotification() {
    if (this.nextClaim) return this.nextClaim;
    if (this.notificationStatus === "sent") return { status: "ALREADY_SENT" } as const;
    if (this.notificationStatus) return { status: "ALREADY_ATTEMPTED" } as const;
    this.notificationStatus = "SENDING";
    return { status: "CLAIMED" } as const;
  }

  async markSmsNotificationSent() {
    this.notificationStatus = "sent";
  }

  async markSmsNotificationFailed() {
    this.notificationStatus = "FAILED";
  }

  async writeAuditEvent(event: SmsAuditEvent) {
    this.auditEvents.push(event);
  }

  async writeStructuredError(error: StructuredSmsError) {
    this.structuredErrors.push(error);
  }

  async persistDashboardWarning(warning: DashboardWarning) {
    this.dashboardWarnings.push(warning);
  }
}

vi.mock("server-only", () => ({}));
