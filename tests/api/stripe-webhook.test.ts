import crypto from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  getDoctorAccessSummary,
  resetDoctorRepositoryForTests,
  upsertDoctorProfile,
} from "@/lib/doctors";

import { POST } from "../../app/api/webhooks/stripe/route";

const WEBHOOK_SECRET = "whsec_test_secret";

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  resetDoctorRepositoryForTests();
});

function stripeSignature(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function stripeRequest(body: Record<string, unknown>, signature: string) {
  const rawBody = JSON.stringify(body);
  return new NextRequest(
    new Request("http://test/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Stripe-Signature": signature,
        "Content-Type": "application/json",
      },
      body: rawBody,
    }),
  );
}

describe("POST /api/webhooks/stripe", () => {
  it("rejects unauthenticated webhook calls", async () => {
    const body = { type: "customer.subscription.updated", data: { object: {} } };
    const res = await POST(stripeRequest(body, "t=1,v1=bad"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid Stripe signature" });
  });

  it("syncs Stripe subscription status into the matching doctor profile", async () => {
    await upsertDoctorProfile({
      userId: "doctor-user-001",
      stripeCustomerId: "cus_001",
      stripeSubscriptionId: "sub_001",
      subscriptionStatus: "ACTIVE",
    });

    const body = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_001",
          customer: "cus_001",
          status: "past_due",
          trial_end: 1_780_000_000,
          items: {
            data: [
              {
                price: {
                  id: "price_doctor_monthly",
                },
              },
            ],
          },
        },
      },
    };
    const rawBody = JSON.stringify(body);
    const res = await POST(stripeRequest(body, stripeSignature(rawBody, WEBHOOK_SECRET)));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, updated: true });

    const summary = await getDoctorAccessSummary("doctor-user-001");
    expect(summary?.doctor).toMatchObject({
      stripePriceId: "price_doctor_monthly",
      stripeStatusRaw: "past_due",
      subscriptionStatus: "PAST_DUE",
    });
    expect(summary?.readableStudyIds).toEqual([]);
  });
});
