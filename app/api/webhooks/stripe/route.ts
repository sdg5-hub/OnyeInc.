import { NextResponse, type NextRequest } from "next/server";

import {
  isExpectedStripeSignature,
  readStripeSubscriptionFromEvent,
  syncStripeSubscription,
} from "@/lib/doctors";

export const runtime = "nodejs";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret is not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !isExpectedStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe payload" }, { status: 400 });
  }

  if (!isRecord(event) || typeof event.type !== "string") {
    return NextResponse.json({ error: "Invalid Stripe event" }, { status: 400 });
  }

  if (!SUBSCRIPTION_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const subscription = readStripeSubscriptionFromEvent(event);
  if (!subscription) {
    return NextResponse.json({ error: "Invalid Stripe subscription event" }, { status: 400 });
  }

  const updated = await syncStripeSubscription(subscription);
  return NextResponse.json({ received: true, updated });
}
