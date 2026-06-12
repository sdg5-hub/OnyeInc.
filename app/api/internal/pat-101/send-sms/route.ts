import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  createSupabasePatientSmsRepository,
  createTwilioSmsProvider,
  processPatientSmsNotification,
  type PatientSmsResult,
} from "@/lib/patient-sms";

type SmsProcessor = (studyId: string) => Promise<PatientSmsResult>;

interface PatientSmsRouteDependencies {
  webhookSecret?: string;
  processSms?: SmsProcessor;
}

const STUDY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  return await handlePatientSmsRequest(request);
}

export async function handlePatientSmsRequest(
  request: NextRequest,
  deps: PatientSmsRouteDependencies = {},
) {
  const expectedSecret = deps.webhookSecret ?? process.env.PAT101_INTERNAL_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "PAT101_WEBHOOK_SECRET_NOT_CONFIGURED" }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-internal-webhook-secret");
  if (!providedSecret || !safeSecretEquals(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const studyId = parseStudyId(body);
  if (!studyId) {
    return NextResponse.json({ error: "INVALID_STUDY_ID" }, { status: 400 });
  }

  try {
    const processSms = deps.processSms ?? createDefaultSmsProcessor();
    const result = await processSms(studyId);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "PAT101_SMS_PROCESSING_FAILED" }, { status: 500 });
  }
}

function parseStudyId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("studyId" in body)) return null;
  const studyId = (body as { studyId?: unknown }).studyId;
  if (typeof studyId !== "string" || !STUDY_ID_PATTERN.test(studyId)) return null;
  return studyId;
}

function safeSecretEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createDefaultSmsProcessor(): SmsProcessor {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("PAT101_SUPABASE_SERVICE_CONFIG_MISSING");
  }
  if (!accountSid || !authToken) {
    throw new Error("PAT101_TWILIO_CONFIG_MISSING");
  }

  const repository = createSupabasePatientSmsRepository({
    supabaseUrl,
    serviceRoleKey,
  });
  const smsProvider = createTwilioSmsProvider({
    accountSid,
    authToken,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  });

  return async (studyId: string) =>
    await processPatientSmsNotification({
      studyId,
      repository,
      smsProvider,
      config: {
        appBaseUrl: process.env.PAT101_APP_BASE_URL ?? "https://app.onyesync.com",
      },
    });
}
