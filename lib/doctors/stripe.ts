import crypto from "crypto";

import { updateDoctorByStripeSubscription } from "./repository";
import type { DoctorSubscriptionStatus, UpsertDoctorProfileInput } from "./types";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readStripeId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value)) {
    return readString(value, "id");
  }

  return undefined;
}

function readUnixSecondsDate(value: unknown) {
  const seconds = typeof value === "number" ? value : undefined;
  return seconds ? new Date(seconds * 1000) : undefined;
}

function readPriceId(subscription: Record<string, unknown>) {
  const items = subscription.items;
  if (!isRecord(items) || !Array.isArray(items.data)) {
    return undefined;
  }

  const firstItem = items.data.find(isRecord);
  if (!firstItem || !isRecord(firstItem.price)) {
    return undefined;
  }

  return readString(firstItem.price, "id");
}

function parseStripeSignature(signatureHeader: string) {
  const parts = signatureHeader.split(",");
  const timestamp = parts
    .map((part) => part.split("="))
    .find(([key]) => key === "t")?.[1];
  const signatures = parts
    .map((part) => part.split("="))
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter(Boolean);

  return {
    timestamp: timestamp ? Number(timestamp) : undefined,
    signatures,
  };
}

export function isExpectedStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const ageInSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageInSeconds > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return signatures.some((signature) => {
    const actualBuffer = Buffer.from(signature, "hex");

    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

export function mapStripeSubscriptionStatus(status: string | undefined): DoctorSubscriptionStatus | undefined {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "canceled":
      return "CANCELED";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "PAST_DUE";
    default:
      return undefined;
  }
}

export async function syncStripeSubscription(subscription: Record<string, unknown>) {
  const stripeSubscriptionId = readString(subscription, "id");
  const stripeCustomerId = readStripeId(subscription.customer);

  if (!stripeSubscriptionId && !stripeCustomerId) {
    return false;
  }

  const stripeStatusRaw = readString(subscription, "status");
  const updates: Omit<Partial<UpsertDoctorProfileInput>, "userId"> = {
    stripeCustomerId,
    stripeSubscriptionId,
    stripeStatusRaw,
    subscriptionStatus: mapStripeSubscriptionStatus(stripeStatusRaw),
    stripePriceId: readPriceId(subscription),
    trialEndsAt: readUnixSecondsDate(subscription.trial_end),
    subscriptionCanceledAt: readUnixSecondsDate(subscription.canceled_at),
  };

  return updateDoctorByStripeSubscription(stripeCustomerId, stripeSubscriptionId, updates);
}

export function readStripeSubscriptionFromEvent(event: unknown) {
  if (!isRecord(event)) {
    return undefined;
  }

  const data = isRecord(event.data) ? event.data : undefined;
  const subscription = data && isRecord(data.object) ? data.object : undefined;
  return subscription;
}
