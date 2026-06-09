import { NextResponse, type NextRequest } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth";
import {
  DuplicateNpiError,
  DUPLICATE_NPI_MESSAGE,
  getDoctorAccessSummary,
  upsertDoctorProfile,
} from "@/lib/doctors";
import type { DoctorSubscriptionStatus } from "@/lib/doctors";

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  return typeof value === "string" ? value : undefined;
}

function readOptionalDate(value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function readSubscriptionStatus(value: unknown): DoctorSubscriptionStatus | undefined {
  if (value !== "TRIALING" && value !== "ACTIVE" && value !== "PAST_DUE" && value !== "CANCELED") {
    return undefined;
  }

  return value;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("doctor")(req);
    const summary = await getDoctorAccessSummary(user.id);

    if (!summary) {
      return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
    }

    return NextResponse.json({ data: summary });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("doctor")(req);
    const body = (await req.json()) as Record<string, unknown>;
    const subscriptionStatus = readSubscriptionStatus(body.subscriptionStatus);

    if (body.subscriptionStatus !== undefined && !subscriptionStatus) {
      return NextResponse.json({ error: "subscriptionStatus is invalid" }, { status: 400 });
    }

    const doctor = await upsertDoctorProfile({
      userId: user.id,
      npi: readOptionalString(body.npi),
      specialty: readOptionalString(body.specialty),
      facilityName: readOptionalString(body.facilityName),
      stripeCustomerId: readOptionalString(body.stripeCustomerId),
      stripeSubscriptionId: readOptionalString(body.stripeSubscriptionId),
      stripePriceId: readOptionalString(body.stripePriceId),
      stripeStatusRaw: readOptionalString(body.stripeStatusRaw),
      subscriptionStatus,
      trialEndsAt: readOptionalDate(body.trialEndsAt),
      subscriptionCanceledAt: readOptionalDate(body.subscriptionCanceledAt),
      npiVerifiedAt: readOptionalDate(body.npiVerifiedAt),
      npiVerificationSource: readOptionalString(body.npiVerificationSource),
    });

    return NextResponse.json({ data: doctor }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateNpiError) {
      return NextResponse.json({ error: DUPLICATE_NPI_MESSAGE }, { status: err.statusCode });
    }

    return toErrorResponse(err);
  }
}
