import { z } from "zod";

import type { Env } from "../../../env.js";
import type { SmsMessage, SmsTransport } from "./gateway-sms.adapter.js";

/*
 * The live SMS providers behind `SmsTransport` (D-147; SMS/OTP audit,
 * docs/engineering/sms-otp-provider-audit.md). AMPM generates and checks its own codes, so each provider
 * is used for delivery only, through its plain DLT SMS endpoint, never its OTP service, which would keep
 * a copy of the code. Neither provider is idempotent: a retry after a timeout may send a second SMS with
 * the same code. That is harmless, and the notification job retries only on failure.
 */

/** The fetch the transports use; the contract tests inject a fake. */
export type SmsFetch = (url: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;

/**
 * A provider failure as a bare, non-personal code (`2factor_400`, `msg91_200`, `sms_network`): never the
 * URL, the key, the number or the text. The adapter logs only this code (`providerErrorCode`).
 */
export class SmsProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SmsProviderError";
  }
}

/** The provider templates a transport holds: the sign-in code's, and the hotel form code's once set. */
interface ProviderTemplates {
  readonly otpTemplate: string;
  readonly hotelFormTemplate?: string | undefined;
}

/**
 * The provider's registered template for a notification template: the client sign-in code (D-147) and the
 * hotel form's code (D-189 §2). Any other, or the hotel form's while SMS_HOTEL_FORM_TEMPLATE is unset, is
 * refused before the provider is called.
 */
function providerTemplate(templateKey: string, templates: ProviderTemplates): string {
  if (templateKey === "auth.client_otp") return templates.otpTemplate;
  if (templateKey === "hotel_form.code" && templates.hotelFormTemplate) {
    return templates.hotelFormTemplate;
  }
  throw new SmsProviderError("sms_template_not_registered");
}

/** "+919876543210" → "919876543210": both providers take the country code without the plus. */
function providerNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

async function post(fetchFn: SmsFetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(url, { ...init, method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new SmsProviderError("sms_network");
  }
}

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export interface TwoFactorConfig {
  readonly apiKey: string;
  /** The DLT-approved header. */
  readonly senderId: string;
  /** The sign-in code's DLT content-template ID (`ctid`). */
  readonly otpTemplate: string;
  /** The hotel form code's DLT content-template ID (`ctid`); its codes are refused while it is unset. */
  readonly hotelFormTemplate?: string | undefined;
  /** The DLT principal-entity ID (`peid`), which spares 2Factor's template sync delay. */
  readonly entityId?: string | undefined;
}

const twoFactorSuccess = z.object({ Status: z.literal("Success"), Details: z.string().min(1) });

/**
 * 2Factor's transactional SMS (`POST https://2factor.in/API/R1/`, `module=TRANS_SMS`): the full text,
 * worded exactly as the DLT-approved template, from the approved header, with the DLT IDs. The API key
 * travels in the form body, never the URL. Success is HTTP 200 with `Status: "Success"`.
 */
export class TwoFactorSmsTransport implements SmsTransport {
  constructor(
    private readonly config: TwoFactorConfig,
    private readonly fetchFn: SmsFetch = fetch,
  ) {}

  async sendSms(message: SmsMessage): Promise<{ providerRef: string }> {
    const ctid = providerTemplate(message.templateKey, this.config);
    const form = new URLSearchParams({
      module: "TRANS_SMS",
      apikey: this.config.apiKey,
      to: providerNumber(message.to),
      from: this.config.senderId,
      msg: message.text,
      ctid,
    });
    if (this.config.entityId) form.set("peid", this.config.entityId);
    const response = await post(this.fetchFn, "https://2factor.in/API/R1/", {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const parsed = twoFactorSuccess.safeParse(await bodyOf(response));
    if (!response.ok || !parsed.success) throw new SmsProviderError(`2factor_${response.status}`);
    return { providerRef: `2factor:${parsed.data.Details}` };
  }
}

export interface Msg91Config {
  readonly authKey: string;
  /** MSG91's template ID, mapped in its panel to the DLT template and the sender ID. */
  readonly otpTemplate: string;
  /** MSG91's template ID for the hotel form's code, mapped the same way; refused while it is unset. */
  readonly hotelFormTemplate?: string | undefined;
}

const msg91Success = z.object({ type: z.literal("success"), message: z.string().min(1) });

/**
 * MSG91's Flow API (`POST https://control.msg91.com/api/v5/flow`): its template ID and the template's
 * named variables (`##code##` in the template takes `code`). An error can come back with HTTP 200, so
 * only `type: "success"` counts. MSG91 also wants the server's outgoing IP on the key's whitelist.
 */
export class Msg91SmsTransport implements SmsTransport {
  constructor(
    private readonly config: Msg91Config,
    private readonly fetchFn: SmsFetch = fetch,
  ) {}

  async sendSms(message: SmsMessage): Promise<{ providerRef: string }> {
    const templateId = providerTemplate(message.templateKey, this.config);
    const response = await post(this.fetchFn, "https://control.msg91.com/api/v5/flow", {
      headers: {
        authkey: this.config.authKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ ...message.variables, mobiles: providerNumber(message.to) }],
      }),
    });
    const parsed = msg91Success.safeParse(await bodyOf(response));
    if (!response.ok || !parsed.success) throw new SmsProviderError(`msg91_${response.status}`);
    return { providerRef: `msg91:${parsed.data.message}` };
  }
}

/** The settings that say whether, and through which provider, SMS is sent. */
export type SmsProviderEnv = Pick<
  Env,
  "SMS_PROVIDER" | "SMS_API_KEY" | "SMS_SENDER_ID" | "SMS_OTP_TEMPLATE"
>;

/**
 * Whether an SMS provider is configured with what its transport needs (env.ts refuses a provider without
 * them, so this is the provider being set): exactly when {@link smsTransportFor} builds a transport, and
 * never true for the console stub. The hotel form's on-screen mode reads it (D-189 §2).
 */
export function smsProviderConfigured(env: SmsProviderEnv): boolean {
  const { SMS_API_KEY: key, SMS_OTP_TEMPLATE: template } = env;
  if (env.SMS_PROVIDER === "2factor") return Boolean(key && template && env.SMS_SENDER_ID);
  if (env.SMS_PROVIDER === "msg91") return Boolean(key && template);
  return false;
}

/** The configured provider's transport, or null while SMS goes to the console stub. */
export function smsTransportFor(env: Env, fetchFn: SmsFetch = fetch): SmsTransport | null {
  const { SMS_API_KEY: key, SMS_OTP_TEMPLATE: template } = env;
  if (!smsProviderConfigured(env) || !key || !template) return null;
  const hotelFormTemplate = env.SMS_HOTEL_FORM_TEMPLATE;
  if (env.SMS_PROVIDER === "2factor" && env.SMS_SENDER_ID) {
    return new TwoFactorSmsTransport(
      {
        apiKey: key,
        senderId: env.SMS_SENDER_ID,
        otpTemplate: template,
        hotelFormTemplate,
        entityId: env.SMS_DLT_ENTITY_ID,
      },
      fetchFn,
    );
  }
  if (env.SMS_PROVIDER === "msg91") {
    return new Msg91SmsTransport(
      { authKey: key, otpTemplate: template, hotelFormTemplate },
      fetchFn,
    );
  }
  return null;
}
