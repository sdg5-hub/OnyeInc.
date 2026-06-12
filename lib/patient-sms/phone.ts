import { createHash } from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePatientPhone(rawPhone: string): string {
  const parsed = parsePhoneNumberFromString(rawPhone, "US");

  if (!parsed || !parsed.isValid()) {
    throw new Error("INVALID_PATIENT_PHONE");
  }

  return parsed.number;
}

export function hashPatientPhone(phoneE164: string): string {
  return createHash("sha256").update(phoneE164).digest("hex");
}
