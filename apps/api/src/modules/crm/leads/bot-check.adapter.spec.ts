import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteverifyBotCheckAdapter, StubBotCheckAdapter } from "./bot-check.adapter.js";

const logger = { warn: vi.fn() };

describe("StubBotCheckAdapter", () => {
  it("accepts any non-empty token and rejects an empty or missing one", async () => {
    const adapter = new StubBotCheckAdapter();
    expect(await adapter.verify("anything")).toBe(true);
    expect(await adapter.verify("  ")).toBe(false);
    expect(await adapter.verify(undefined)).toBe(false);
  });
});

describe("SiteverifyBotCheckAdapter (C1)", () => {
  afterEach(() => vi.restoreAllMocks());

  function adapter(): SiteverifyBotCheckAdapter {
    return new SiteverifyBotCheckAdapter("https://verify.example/siteverify", "secret", logger);
  }

  it("fails closed on a missing token without calling the provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await adapter().verify(undefined, undefined)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the token and secret and returns the provider's success verdict", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(await adapter().verify("token-123", "203.0.113.1")).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://verify.example/siteverify");
    const sent = String((init as RequestInit).body);
    expect(sent).toContain("secret=secret");
    expect(sent).toContain("response=token-123");
    expect(sent).toContain("remoteip=203.0.113.1");
  });

  it("returns false on a non-success verdict", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
      }),
    );
    expect(await adapter().verify("bad-token", undefined)).toBe(false);
  });

  it("fails closed and logs when the provider call throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await adapter().verify("token", undefined)).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "crm.bot_check.verify_error",
      expect.objectContaining({ error: expect.stringContaining("network down") }),
    );
  });
});
