import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { handlePatientSmsRequest } from "@/app/api/internal/pat-101/send-sms/route";

const STUDY_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/internal/pat-101/send-sms", () => {
  it("rejects requests without the internal webhook secret", async () => {
    const res = await handlePatientSmsRequest(makeRequest({ studyId: STUDY_ID }), {
      webhookSecret: "secret",
      processSms: vi.fn(),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("rejects invalid study IDs", async () => {
    const res = await handlePatientSmsRequest(makeRequest({ studyId: "not-a-uuid" }, "secret"), {
      webhookSecret: "secret",
      processSms: vi.fn(),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_STUDY_ID" });
  });

  it("calls the SMS processor after auth and returns the non-blocking result", async () => {
    const processSms = vi.fn().mockResolvedValue({
      status: "sent",
      studyId: STUDY_ID,
      twilioMessageSid: "SM_TEST",
    });

    const res = await handlePatientSmsRequest(makeRequest({ studyId: STUDY_ID }, "secret"), {
      webhookSecret: "secret",
      processSms,
    });

    expect(res.status).toBe(200);
    expect(processSms).toHaveBeenCalledWith(STUDY_ID);
    expect(await res.json()).toEqual({
      status: "sent",
      studyId: STUDY_ID,
      twilioMessageSid: "SM_TEST",
    });
  });

  it("returns a sanitized diagnostic when SMS processing throws", async () => {
    const processSms = vi.fn().mockRejectedValue(new Error("Twilio failed for +12125550100"));

    const res = await handlePatientSmsRequest(makeRequest({ studyId: STUDY_ID }, "secret"), {
      webhookSecret: "secret",
      processSms,
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "PAT101_SMS_PROCESSING_FAILED",
      detail: "Twilio failed for [REDACTED_PHONE]",
    });
  });
});

function makeRequest(body: unknown, secret?: string): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secret) headers.set("X-Internal-Webhook-Secret", secret);

  return new NextRequest(
    new Request("http://test/api/internal/pat-101/send-sms", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}
