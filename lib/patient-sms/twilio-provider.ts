import twilio from "twilio";

import type { SmsProvider } from "./types";

export interface TwilioSmsProviderOptions {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  fromNumber?: string;
}

export function createTwilioSmsProvider(options: TwilioSmsProviderOptions): SmsProvider {
  if (!options.messagingServiceSid && !options.fromNumber) {
    throw new Error("PAT101_TWILIO_SENDER_MISSING");
  }

  const client = twilio(options.accountSid, options.authToken);

  return {
    async sendSms(input) {
      const message = await client.messages.create({
        body: input.body,
        to: input.to,
        ...(options.messagingServiceSid
          ? { messagingServiceSid: options.messagingServiceSid }
          : { from: options.fromNumber }),
      });

      return { messageSid: message.sid };
    },
  };
}
