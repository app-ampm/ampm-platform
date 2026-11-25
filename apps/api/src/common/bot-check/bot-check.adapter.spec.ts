import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOT_CHECK_TIMEOUT_MS,
  SiteverifyBotCheckAdapter,
  StubBotCheckAdapter,
  type BotCheckAdapter,
  type BotCheckFetch,
} from "./bot-check.adapter.js";

/*
 * The public forms' bot check (C1; D-189 §7): the stub for development and tests, and the siteverify
 * adapter (Cloudflare Turnstile, reCAPTCHA) for production. It checks the provider's verdict, and when the
 * caller names them, the hostname the challenge was solved on and the widget's action; it gives up after 5
 * seconds; and it fails closed on anything it cannot read. Synthetic hosts and tokens only.
 */

const logger = { warn: vi.fn() };
const SITE = {
  remoteIp: "203.0.113.1",
  expectedHostnames: ["site.ampm.example"],
  expectedAction: "hf_code",
};

function answering(body: unknown, status = 200): BotCheckFetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

function adapter(fetchFn: BotCheckFetch, timeoutMs?: number): SiteverifyBotCheckAdapter {
  return new SiteverifyBotCheckAdapter(
    "https://verify.example/siteverify",
    "secret",
    logger,
    fetchFn,
    timeoutMs,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  logger.warn.mockClear();
});

describe("StubBotCheckAdapter", () => {
  it("accepts any non-empty token and rejects an empty or missing one, whatever it is asked to check", async () => {
    // Through the interface, as every caller holds it.
    const stub: BotCheckAdapter = new StubBotCheckAdapter();
    expect(await stub.verify("anything", { remoteIp: undefined })).toBe(true);
    expect(await stub.verify("anything", SITE)).toBe(true);
    expect(await stub.verify("  ", SITE)).toBe(false);
    expect(await stub.verify(undefined, { remoteIp: undefined })).toBe(false);
  });
});

describe("SiteverifyBotCheckAdapter (C1)", () => {
  it("fails closed on a missing token without calling the provider", async () => {
    const fetchFn = answering({ success: true });
    expect(await adapter(fetchFn).verify(undefined, { remoteIp: undefined })).toBe(false);
    expect(await adapter(fetchFn).verify(" ", SITE)).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts the token, the secret and the address, and returns the provider's verdict", async () => {
    const fetchFn = answering({ success: true });
    expect(await adapter(fetchFn).verify("token-123", { remoteIp: "203.0.113.1" })).toBe(true);
    const [url, init] = vi.mocked(fetchFn).mock.calls[0] ?? [];
    expect(url).toBe("https://verify.example/siteverify");
    expect(init?.method).toBe("POST");
    const sent = new URLSearchParams(String(init?.body));
    expect(Object.fromEntries(sent)).toEqual({
      secret: "secret",
      response: "token-123",
      remoteip: "203.0.113.1",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns false on a non-success verdict or a provider error status", async () => {
    const refused = answering({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await adapter(refused).verify("bad-token", { remoteIp: undefined })).toBe(false);
    expect(await adapter(answering({ success: true }, 500)).verify("t", SITE)).toBe(false);
  });

  it("fails closed on an answer it cannot read, never trusting its shape", async () => {
    for (const body of [{ success: "true" }, { ok: true }, null, [true], "success"]) {
      expect(
        await adapter(answering(body)).verify("t", { remoteIp: undefined }),
        JSON.stringify(body),
      ).toBe(false);
    }
    const notJson: BotCheckFetch = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await adapter(notJson).verify("t", { remoteIp: undefined })).toBe(false);
  });

  it("checks the hostname the challenge was solved on when the caller names its hosts", async () => {
    const solvedOn = (hostname: unknown) =>
      answering({ success: true, hostname, action: "hf_code" });
    expect(await adapter(solvedOn("site.ampm.example")).verify("t", SITE)).toBe(true);
    // Hostnames compare without case.
    expect(await adapter(solvedOn("Site.AMPM.example")).verify("t", SITE)).toBe(true);
    for (const hostname of ["evil.example", "", undefined, "site.ampm.example.evil.example"]) {
      expect(await adapter(solvedOn(hostname)).verify("t", SITE), String(hostname)).toBe(false);
    }
    const either = { ...SITE, expectedHostnames: ["www.ampm.example", "site.ampm.example"] };
    expect(await adapter(solvedOn("site.ampm.example")).verify("t", either)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith("bot_check.refused", { reason: "hostname" });
  });

  it("checks the widget's action when the caller names one", async () => {
    const acted = (action: unknown) =>
      answering({ success: true, hostname: "site.ampm.example", action });
    expect(await adapter(acted("hf_code")).verify("t", SITE)).toBe(true);
    for (const action of ["hf_submit", "", undefined, "HF_CODE"]) {
      expect(await adapter(acted(action)).verify("t", SITE), String(action)).toBe(false);
    }
    expect(logger.warn).toHaveBeenCalledWith("bot_check.refused", { reason: "action" });
  });

  it("keeps today's checks for a caller that names no host or action (the website enquiry)", async () => {
    const anywhere = answering({ success: true, hostname: "elsewhere.example", action: "other" });
    expect(await adapter(anywhere).verify("t", { remoteIp: "203.0.113.1" })).toBe(true);
  });

  it("gives up after its timeout, 5 seconds by default, and fails closed", async () => {
    expect(BOT_CHECK_TIMEOUT_MS).toBe(5_000);
    const hanging: BotCheckFetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    expect(await adapter(hanging, 30).verify("t", SITE)).toBe(false);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(logger.warn).toHaveBeenCalledWith(
      "bot_check.verify_error",
      expect.objectContaining({ error: expect.stringMatching(/TimeoutError|abort/i) }),
    );
  });

  it("fails closed and logs when the provider call throws", async () => {
    const down: BotCheckFetch = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await adapter(down).verify("token", { remoteIp: undefined })).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "bot_check.verify_error",
      expect.objectContaining({ error: expect.stringContaining("network down") }),
    );
  });

  it("reaches the global fetch when none is given", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const plain = new SiteverifyBotCheckAdapter("https://verify.example/siteverify", "s", logger);
    expect(await plain.verify("t", { remoteIp: undefined })).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
