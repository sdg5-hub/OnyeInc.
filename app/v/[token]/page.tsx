import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PatientTokenError } from "@/components/patient-token-error";
import { createPatientTokenRepositoryFromEnv, validatePatientTokenAccess } from "@/lib/patient-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PatientTokenPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PatientTokenPage({ params }: PatientTokenPageProps) {
  const { token } = await params;
  const requestHeaders = await headers();
  const decision = await resolveTokenDecision({
    token,
    requestHeaders,
  });

  if (decision.outcome === "VALID") {
    redirect(decision.redirectPath);
  }

  return (
    <PatientTokenError
      title={decision.errorTitle}
      message={decision.errorMessage}
      supportHref={process.env.PAT102_SUPPORT_URL ?? "mailto:support@onyesync.com"}
    />
  );
}

async function resolveTokenDecision(input: { token: string; requestHeaders: Headers }) {
  try {
    const repository = createPatientTokenRepositoryFromEnv();
    return await validatePatientTokenAccess({
      token: input.token,
      ipAddress: getClientIp(input.requestHeaders),
      userAgent: input.requestHeaders.get("user-agent") ?? "unknown",
      repository,
    });
  } catch {
    return {
      outcome: "NOT_FOUND" as const,
      tokenId: null,
      errorTitle: "Invalid link",
      errorMessage: "This link is invalid or has already been used. Please check the link in your SMS and try again.",
    };
  }
}

function getClientIp(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return requestHeaders.get("x-real-ip") ?? requestHeaders.get("cf-connecting-ip") ?? "unknown";
}
