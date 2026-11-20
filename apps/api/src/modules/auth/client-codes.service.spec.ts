import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGN_IN_ERRORS } from "@ampm/core";

import type { AppLogger } from "../../common/logger.service.js";
import {
  MemoryRateLimitStore,
  type RateLimitHit,
} from "../../common/rate-limit/rate-limit.store.js";
import type { Env } from "../../env.js";
import type { AuthTokenService } from "../../identity/auth-token.service.js";
import { hashOneTimeCode } from "../../identity/one-time-code.js";
import { signInKeysFor, type SignInKeys } from "../../identity/sign-in-keys.js";
import type {
  NotificationService,
  QueueNotification,
} from "../admin/notification/notification.service.js";
import { ClientCodes } from "./client-codes.service.js";

const KEYS = signInKeysFor({
  IDENTITY_PROVIDER: "local",
  IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-long-enough-32",
});
const CLIENT = { id: "client-1", phone: "+919876543210" };

/** The one live code a client has, as `auth_tokens` keeps it: newest only, five tries, reserved first. */
function tokensFake() {
  let live: { tokenHash: string; attempts: number; used: boolean } | null = null;
  const fake = {
    issueOneTimeCode: vi.fn(async (_userId: string, tokenHash: string) => {
      live = { tokenHash, attempts: 0, used: false };
    }),
    findLiveOneTimeCode: vi.fn(async () =>
      live && !live.used
        ? { id: "code-1", tokenHash: live.tokenHash, attempts: live.attempts }
        : null,
    ),
    claimAttempt: vi.fn(async () => {
      if (!live || live.used || live.attempts >= 5) return false;
      live.attempts += 1;
      return true;
    }),
    burnIfSpent: vi.fn(async () => {
      if (live && live.attempts >= 5) live.used = true;
    }),
    markUsedIfLive: vi.fn(async () => {
      if (!live || live.used) return false;
      live.used = true;
      return true;
    }),
  };
  return fake;
}

class DownLimiter extends MemoryRateLimitStore {
  override async hit(): Promise<RateLimitHit> {
    throw new Error("redis down");
  }
}

function harness(
  options: {
    echo?: boolean;
    nodeEnv?: string;
    keys?: SignInKeys | null;
    limiter?: MemoryRateLimitStore;
  } = {},
) {
  const tokens = tokensFake();
  const queue = vi.fn(async (_message: QueueNotification) => ({
    suppressed: false as const,
    notificationId: "n1",
  }));
  const logger = { info: vi.fn(), warn: vi.fn() };
  const env = {
    NODE_ENV: options.nodeEnv ?? "development",
    CLIENT_OTP_SCREEN_ECHO: options.echo ?? false,
  } as unknown as Env;
  const codes = new ClientCodes(
    options.keys === undefined ? KEYS : options.keys,
    env,
    tokens as unknown as AuthTokenService,
    { queue } as unknown as NotificationService,
    options.limiter ?? new MemoryRateLimitStore(),
    logger as unknown as AppLogger,
  );
  return { codes, tokens, queue, logger };
}

describe("ClientCodes (D-147)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a required SMS with the code, keeps only its HMAC, and keeps it off screen by default", async () => {
    const { codes, tokens, queue } = harness();
    const sent = await codes.send(CLIENT);
    expect(sent).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
    const message = queue.mock.calls[0]?.[0];
    expect(message).toMatchObject({
      channel: "sms",
      required: true,
      templateKey: "auth.client_otp",
    });
    const code = message?.variables?.["code"] ?? "";
    expect(code).toMatch(/^\d{6}$/);
    const stored = tokens.issueOneTimeCode.mock.calls[0]?.[1];
    expect(stored).not.toContain(code);
    expect(stored).toBe(hashOneTimeCode(CLIENT.id, code, KEYS?.otpKey ?? Buffer.alloc(0)));
  });

  it("returns the code for the screen only while the on-screen code is switched on", async () => {
    const sent = await harness({ echo: true }).codes.send(CLIENT);
    expect(sent.screenCode).toMatch(/^\d{6}$/);
  });

  it("accepts the code once; a wrong one counts, and five wrong ones burn it", async () => {
    const first = harness({ echo: true });
    const code = (await first.codes.send(CLIENT)).screenCode ?? "";
    await first.codes.verify(CLIENT.id, code);
    await expect(first.codes.verify(CLIENT.id, code)).rejects.toThrow(
      SIGN_IN_ERRORS.invalidClientCode,
    );

    const second = harness({ echo: true });
    const live = (await second.codes.send(CLIENT)).screenCode ?? "";
    const wrong = live === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) {
      await expect(second.codes.verify(CLIENT.id, wrong)).rejects.toThrow(
        SIGN_IN_ERRORS.invalidClientCode,
      );
    }
    await expect(second.codes.verify(CLIENT.id, live)).rejects.toThrow(
      SIGN_IN_ERRORS.invalidClientCode,
    );
    // Five tries were reserved; the burned code is no longer live, so the sixth reserves nothing.
    expect(second.tokens.claimAttempt).toHaveBeenCalledTimes(5);
  });

  /** Asks for `count` codes 31 seconds apart, past the pause each time. */
  async function spaced(codes: ClientCodes, count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      vi.advanceTimersByTime(31_000);
      await codes.allow(CLIENT.phone);
    }
  }

  it("pauses 30 seconds between two codes for the same number", async () => {
    vi.useFakeTimers();
    const { codes } = harness();
    await codes.allow(CLIENT.phone);
    await expect(codes.allow(CLIENT.phone)).rejects.toThrow(SIGN_IN_ERRORS.clientCodeTooSoon);
    vi.advanceTimersByTime(31_000);
    await codes.allow(CLIENT.phone);
  });

  it("allows five codes an hour for a number", async () => {
    vi.useFakeTimers();
    const { codes } = harness();
    await spaced(codes, 5);
    vi.advanceTimersByTime(31_000);
    await expect(codes.allow(CLIENT.phone)).rejects.toThrow(SIGN_IN_ERRORS.clientCodeLimit);
  });

  it("allows ten codes a day for a number, however they are spread", async () => {
    vi.useFakeTimers();
    const { codes } = harness();
    await spaced(codes, 5);
    vi.advanceTimersByTime(60 * 60 * 1000);
    await spaced(codes, 5);
    vi.advanceTimersByTime(60 * 60 * 1000);
    await expect(codes.allow(CLIENT.phone)).rejects.toThrow(SIGN_IN_ERRORS.clientCodeLimit);
  });

  it("issues no code when the limiter cannot count (fails closed, 503)", async () => {
    const { codes, logger } = harness({ limiter: new DownLimiter() });
    await expect(codes.allow(CLIENT.phone)).rejects.toThrow(SIGN_IN_ERRORS.clientCodesUnavailable);
    expect(logger.warn).toHaveBeenCalledWith("auth.client_code_throttle_unavailable", {});
  });

  it("warns at every production boot while codes are shown on screen, and only then", () => {
    const shown = harness({ echo: true, nodeEnv: "production" });
    shown.codes.onModuleInit();
    expect(shown.logger.warn).toHaveBeenCalledWith(
      "auth.client_code_screen_echo_on",
      expect.any(Object),
    );
    const hidden = harness({ echo: false, nodeEnv: "production" });
    hidden.codes.onModuleInit();
    expect(hidden.logger.warn).not.toHaveBeenCalled();
  });

  it("answers 404 where the identity provider signs people in itself (Cognito)", async () => {
    const { codes } = harness({ keys: null });
    await expect(codes.send(CLIENT)).rejects.toThrow(/not found/i);
  });
});
