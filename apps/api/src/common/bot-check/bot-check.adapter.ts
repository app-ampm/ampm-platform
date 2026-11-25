import { Injectable } from "@nestjs/common";
import type { Logger } from "@ampm/core";
import { z } from "zod";

/**
 * The bot check on the public forms (PUB-06, AC-01.9; the hotel form, D-189 §3 and §7; security.md "a bot
 * check on public forms"). One adapter interface, one implementation behind it, chosen by configuration:
 * the stub for development and staging, the siteverify adapter for production (env.ts refuses the stub
 * there, C1). Business logic never imports a provider SDK (api.md). The token travels in the request body
 * and is verified here; it is never stored. Provided by BotCheckModule to any module that imports it.
 */
export const BOT_CHECK_ADAPTER = Symbol("BOT_CHECK_ADAPTER");

/** What a caller asks the provider's verdict to show beyond success. */
export interface BotCheckOptions {
  /** The caller's address, sent to the provider as `remoteip`; undefined when unknown. */
  readonly remoteIp: string | undefined;
  /**
   * The hostnames the challenge must have been solved on, any one of them, compared without case (the
   * hotel form: the host of PUBLIC_SITE_URL). Unchecked when absent.
   */
  readonly expectedHostnames?: readonly string[];
  /** The widget's action the verdict must name (the hotel form's code request: `hf_code`). Unchecked when absent. */
  readonly expectedAction?: string;
}

export interface BotCheckAdapter {
  /**
   * True when the token is a genuine human signal for this request and shows what the options ask. Never
   * throws; a bad token, a mismatch or a provider failure is false.
   *
   * @example
   * await botCheck.verify(body.botToken, { remoteIp, expectedHostnames: [siteHost], expectedAction: "hf_code" });
   */
  verify(token: string | undefined, options: BotCheckOptions): Promise<boolean>;
}

/** Whether a token is there at all: a missing or blank one never reaches a provider. */
function present(token: string | undefined): token is string {
  return typeof token === "string" && token.trim().length > 0;
}

/**
 * The development/test sandbox: accepts any non-empty token and rejects a missing one, so a form's abuse
 * gate can be exercised (AC-01.9) without a provider. It cannot see a hostname or an action, so it checks
 * neither. Refused in production by env.ts (C1).
 */
@Injectable()
export class StubBotCheckAdapter implements BotCheckAdapter {
  verify(token: string | undefined): Promise<boolean> {
    return Promise.resolve(present(token));
  }
}

/** How long the provider gets before the check fails closed (D-189 §3). */
export const BOT_CHECK_TIMEOUT_MS = 5_000;

/** The fetch the adapter posts with; the tests inject a fake. */
export type BotCheckFetch = (url: string, init: RequestInit) => Promise<Response>;

/** The slice of the logger this adapter needs (it logs a failure or a refusal's reason, then fails closed). */
type BotCheckLogger = Pick<Logger, "warn">;

/**
 * Siteverify's answer, as Cloudflare Turnstile and reCAPTCHA give it, read without trusting its shape: a
 * field that is not what it should be makes the answer unreadable, which fails closed.
 */
const siteverifyAnswer = z.object({
  success: z.boolean(),
  hostname: z.string().nullish(),
  action: z.string().nullish(),
});
type SiteverifyAnswer = z.infer<typeof siteverifyAnswer>;

/** Why a successful verdict is still refused: it was solved elsewhere, or for another action. */
function mismatch(
  answer: SiteverifyAnswer,
  options: BotCheckOptions,
): "hostname" | "action" | null {
  const hosts = options.expectedHostnames;
  if (hosts !== undefined) {
    const host = (answer.hostname ?? "").toLowerCase();
    if (!hosts.some((expected) => expected.toLowerCase() === host)) return "hostname";
  }
  if (options.expectedAction !== undefined && answer.action !== options.expectedAction) {
    return "action";
  }
  return null;
}

/**
 * The production bot check: posts the token to a provider's verify endpoint (Cloudflare Turnstile and
 * Google reCAPTCHA share the `secret`+`response` form POST returning `{ success, hostname, action }`), with
 * the secret from the secret zone. Fails closed: a missing token, a transport error, no answer within
 * {@link BOT_CHECK_TIMEOUT_MS}, an unreadable answer, a non-success verdict, or a hostname or action other
 * than the caller asked for is false, and it never throws into the request (security.md).
 */
export class SiteverifyBotCheckAdapter implements BotCheckAdapter {
  constructor(
    private readonly verifyUrl: string,
    private readonly secret: string,
    private readonly logger: BotCheckLogger,
    private readonly fetchFn: BotCheckFetch = (url, init) => fetch(url, init),
    private readonly timeoutMs: number = BOT_CHECK_TIMEOUT_MS,
  ) {}

  async verify(token: string | undefined, options: BotCheckOptions): Promise<boolean> {
    if (!present(token)) return false;
    const answer = await this.ask(token, options.remoteIp);
    if (answer === null || !answer.success) return false;
    const reason = mismatch(answer, options);
    if (reason !== null) {
      // A token solved elsewhere or for another form; logged by reason only, never the token or host.
      this.logger.warn("bot_check.refused", { reason });
      return false;
    }
    return true;
  }

  /** The provider's answer, or null when it could not be had or read in time. */
  private async ask(token: string, remoteIp: string | undefined): Promise<SiteverifyAnswer | null> {
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    try {
      const response = await this.fetchFn(this.verifyUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return null;
      const parsed = siteverifyAnswer.safeParse(await response.json());
      if (!parsed.success) this.logger.warn("bot_check.unreadable_answer", {});
      return parsed.success ? parsed.data : null;
    } catch (error) {
      // A provider outage or a timeout must not crash the public form; fail closed and record it.
      this.logger.warn("bot_check.verify_error", { error: String(error) });
      return null;
    }
  }
}
