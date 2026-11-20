import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TurnstileApi } from "./turnstile";

/*
 * The hand-written Turnstile loader against a stand-in page: the site's tests run without a DOM, and
 * the loader needs only `window.turnstile`, `document.createElement` and `document.head.append`.
 */

/** A <script> as the loader uses it: its source and flag, its listeners, and its removal. */
class FakeScript {
  src = "";
  async = false;
  isRemoved = false;
  private readonly listeners = new Map<string, () => void>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  remove(): void {
    this.isRemoved = true;
  }

  /** The browser done with the script: "load" once it has run, "error" when the fetch failed. */
  fire(type: "load" | "error"): void {
    this.listeners.get(type)?.();
  }
}

const TURNSTILE: TurnstileApi = {
  render: () => "widget-1",
  reset: () => undefined,
  remove: () => undefined,
};

let page: { turnstile?: TurnstileApi | undefined };
let scripts: FakeScript[];

beforeEach(() => {
  page = {};
  scripts = [];
  vi.stubGlobal("window", page);
  vi.stubGlobal("document", {
    createElement: () => new FakeScript(),
    head: { append: (script: FakeScript) => scripts.push(script) },
  });
  // The loader remembers its script between calls, so every test starts from a fresh module.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshLoader() {
  const { loadTurnstile } = await import("./turnstile");
  return loadTurnstile;
}

describe("loadTurnstile", () => {
  it("uses Turnstile already on the page without adding its script again", async () => {
    page.turnstile = TURNSTILE;
    const loadTurnstile = await freshLoader();
    await expect(loadTurnstile()).resolves.toBe(TURNSTILE);
    expect(scripts).toHaveLength(0);
  });

  it("adds one async script, for explicit rendering, and resolves once it has run", async () => {
    const loadTurnstile = await freshLoader();
    const first = loadTurnstile();
    const second = loadTurnstile();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(scripts[0]?.async).toBe(true);
    page.turnstile = TURNSTILE;
    scripts[0]?.fire("load");
    await expect(first).resolves.toBe(TURNSTILE);
    await expect(second).resolves.toBe(TURNSTILE);
  });

  it("removes a script that did not load and fetches it afresh on the next call", async () => {
    const loadTurnstile = await freshLoader();
    const failed = loadTurnstile();
    scripts[0]?.fire("error");
    await expect(failed).rejects.toThrow("Turnstile's script did not load");
    expect(scripts[0]?.isRemoved).toBe(true);

    const retried = loadTurnstile();
    expect(scripts).toHaveLength(2);
    page.turnstile = TURNSTILE;
    scripts[1]?.fire("load");
    await expect(retried).resolves.toBe(TURNSTILE);
  });

  it("refuses a script that ran without Turnstile's API", async () => {
    const loadTurnstile = await freshLoader();
    const loaded = loadTurnstile();
    scripts[0]?.fire("load");
    await expect(loaded).rejects.toThrow("Turnstile's script ran without its API");
    expect(scripts[0]?.isRemoved).toBe(true);
  });
});
