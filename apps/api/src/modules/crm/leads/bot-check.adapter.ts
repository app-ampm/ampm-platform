import { Injectable } from "@nestjs/common";

/**
 * The bot check on the public enquiry form (PUB-06, AC-01.9; security.md "a bot check on public
 * forms"). One adapter interface, one implementation behind it, a sandbox for dev/test and a real
 * provider (Cloudflare Turnstile / reCAPTCHA) at go-live — business logic never imports the provider
 * SDK (api.md). The token travels in the request body and is verified here; it is never stored.
 */
export const BOT_CHECK_ADAPTER = Symbol("BOT_CHECK_ADAPTER");

export interface BotCheckAdapter {
  /** True when the token is a genuine human signal for this request. Never throws; a bad token is false. */
  verify(token: string | undefined, remoteIp: string | undefined): Promise<boolean>;
}

/**
 * The development/test sandbox: accepts any non-empty token and rejects a missing one, so the form's
 * abuse gate can be exercised (AC-01.9) without a provider. The real adapter calls the provider's
 * verify endpoint with its secret from the secret zone.
 */
@Injectable()
export class StubBotCheckAdapter implements BotCheckAdapter {
  verify(token: string | undefined): Promise<boolean> {
    return Promise.resolve(typeof token === "string" && token.trim().length > 0);
  }
}
