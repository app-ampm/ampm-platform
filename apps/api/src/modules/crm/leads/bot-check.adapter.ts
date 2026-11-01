import { Injectable } from "@nestjs/common";
import type { Logger } from "@ampm/core";

/**
 * The bot check on the public enquiry form (PUB-06, AC-01.9; security.md "a bot check on public
 * forms"). One adapter interface, one implementation behind it, chosen by configuration: the stub for
 * development and staging, the siteverify adapter for production (env.ts refuses the stub there, C1).
 * Business logic never imports a provider SDK (api.md). The token travels in the request body and is
 * verified here; it is never stored.
 */
export const BOT_CHECK_ADAPTER = Symbol("BOT_CHECK_ADAPTER");

export interface BotCheckAdapter {
  /** True when the token is a genuine human signal for this request. Never throws; a bad token is false. */
  verify(token: string | undefined, remoteIp: string | undefined): Promise<boolean>;
}

/**
 * The development/test sandbox: accepts any non-empty token and rejects a missing one, so the form's
 * abuse gate can be exercised (AC-01.9) without a provider. Refused in production by env.ts (C1).
 */
@Injectable()
export class StubBotCheckAdapter implements BotCheckAdapter {
  verify(token: string | undefined): Promise<boolean> {
    return Promise.resolve(typeof token === "string" && token.trim().length > 0);
  }
}

/** The slice of the logger this adapter needs (it logs a verify error, then fails closed). */
type BotCheckLogger = Pick<Logger, "warn">;

/**
 * The production bot check: posts the token to a provider's verify endpoint (Cloudflare Turnstile and
 * Google reCAPTCHA share the `secret`+`response` form POST returning `{ success }`), with the secret
 * from the secret zone. Fails closed — a missing token, a transport error or a non-success verdict is
 * false — and never throws into the request (security.md; the enquiry turns a false into a 400).
 */
export class SiteverifyBotCheckAdapter implements BotCheckAdapter {
  constructor(
    private readonly verifyUrl: string,
    private readonly secret: string,
    private readonly logger: BotCheckLogger,
  ) {}

  async verify(token: string | undefined, remoteIp: string | undefined): Promise<boolean> {
    if (typeof token !== "string" || token.trim().length === 0) return false;
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    try {
      const response = await fetch(this.verifyUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) return false;
      const result: unknown = await response.json();
      return (
        typeof result === "object" &&
        result !== null &&
        (result as { success?: unknown }).success === true
      );
    } catch (error) {
      // A provider outage must not crash the public form; fail the bot check closed and record it.
      this.logger.warn("crm.bot_check.verify_error", { error: String(error) });
      return false;
    }
  }
}
