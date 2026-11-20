import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHECKING, mountBotCheck, renderBotCheck, type BotCheck } from "./bot-check";
import { loadTurnstile, type TurnstileApi, type TurnstileRenderOptions } from "./turnstile";

vi.mock("./turnstile", () => ({ loadTurnstile: vi.fn() }));

const SITE_KEY = "1x00000000000000000000AA";
const TARGET = { container: "#bot-check", width: 360, siteKey: SITE_KEY };

/** Turnstile as the form calls it: it keeps the options it drew with and the widgets it was asked to change. */
function fakeTurnstile(widgetId: string | null = "widget-1") {
  const drawn: TurnstileRenderOptions[] = [];
  const resets: string[] = [];
  const removals: string[] = [];
  const api: TurnstileApi = {
    render: (_container, options) => {
      drawn.push(options);
      return widgetId;
    },
    reset: (id) => {
      resets.push(id);
    },
    remove: (id) => {
      removals.push(id);
    },
  };
  /** The options of the one widget drawn. */
  const options = (): TurnstileRenderOptions => {
    const [only] = drawn;
    if (!only || drawn.length !== 1) throw new Error(`expected one widget, drew ${drawn.length}`);
    return only;
  };
  return { api, drawn, resets, removals, options };
}

/** Collects every state the bot check reports. */
function reports() {
  const seen: BotCheck[] = [];
  return { seen, report: (check: BotCheck) => seen.push(check) };
}

/** Lets the loader's promise settle. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("renderBotCheck", () => {
  it("draws the site key's Managed widget in the dark theme, its token kept out of the form's fields", () => {
    const turnstile = fakeTurnstile();
    renderBotCheck(turnstile.api, TARGET, () => undefined);
    const options = turnstile.options();
    expect(options.sitekey).toBe(SITE_KEY);
    expect(options.theme).toBe("dark");
    expect(options["response-field"]).toBe(false);
    expect(options.size).toBe("flexible");
  });

  it("draws the compact widget in a column narrower than the flexible one's 300px", () => {
    const turnstile = fakeTurnstile();
    renderBotCheck(turnstile.api, { ...TARGET, width: 288 }, () => undefined);
    expect(turnstile.options().size).toBe("compact");
  });

  it("reports the token, and drops it when it expires or an interactive challenge times out", () => {
    const turnstile = fakeTurnstile();
    const { seen, report } = reports();
    renderBotCheck(turnstile.api, TARGET, report);
    const options = turnstile.options();
    options.callback("token-1");
    options["expired-callback"]();
    options.callback("token-2");
    options["timeout-callback"]();
    expect(seen).toEqual([
      { status: "passed", token: "token-1" },
      CHECKING,
      { status: "passed", token: "token-2" },
      CHECKING,
    ]);
    // Turnstile refreshes the check itself (refresh-expired, refresh-timeout): no reset from here.
    expect(turnstile.resets).toEqual([]);
  });

  it("reports an error as handled and leaves the retry to Turnstile", () => {
    const turnstile = fakeTurnstile();
    const { seen, report } = reports();
    renderBotCheck(turnstile.api, TARGET, report);
    expect(turnstile.options()["error-callback"]("110200")).toBe(true);
    expect(seen).toEqual([{ status: "failed" }]);
    // A reset here would spin on an error that never clears; Turnstile's own retry backs off.
    expect(turnstile.resets).toEqual([]);
  });

  it("reports a browser Turnstile cannot run in", () => {
    const turnstile = fakeTurnstile();
    const { seen, report } = reports();
    renderBotCheck(turnstile.api, TARGET, report);
    turnstile.options()["unsupported-callback"]();
    expect(seen).toEqual([{ status: "unsupported" }]);
  });

  it("resets and removes its own widget, and touches nothing when none was drawn", () => {
    const drawn = fakeTurnstile();
    const widget = renderBotCheck(drawn.api, TARGET, () => undefined);
    widget.reset();
    widget.remove();
    expect(drawn.resets).toEqual(["widget-1"]);
    expect(drawn.removals).toEqual(["widget-1"]);

    const none = fakeTurnstile(null);
    const missing = renderBotCheck(none.api, TARGET, () => undefined);
    missing.reset();
    missing.remove();
    expect(none.resets).toEqual([]);
    expect(none.removals).toEqual([]);
  });
});

describe("mountBotCheck", () => {
  beforeEach(() => {
    vi.mocked(loadTurnstile).mockReset();
  });

  it("draws the widget once Turnstile has loaded, and resets it only then", async () => {
    const turnstile = fakeTurnstile();
    vi.mocked(loadTurnstile).mockResolvedValue(turnstile.api);
    const { seen, report } = reports();
    const mount = mountBotCheck(TARGET, report);
    expect(mount.reset()).toBe(false);
    await settle();
    turnstile.options().callback("token-1");
    expect(seen).toEqual([{ status: "passed", token: "token-1" }]);
    expect(mount.reset()).toBe(true);
    expect(turnstile.resets).toEqual(["widget-1"]);
  });

  it("reports a failed check when Turnstile's script does not load", async () => {
    vi.mocked(loadTurnstile).mockRejectedValue(new Error("Turnstile's script did not load"));
    const { seen, report } = reports();
    const mount = mountBotCheck(TARGET, report);
    await settle();
    expect(seen).toEqual([{ status: "failed" }]);
    // No widget to reset: the caller loads the script again instead.
    expect(mount.reset()).toBe(false);
  });

  it("removes the widget on unmount and reports nothing afterwards", async () => {
    const turnstile = fakeTurnstile();
    vi.mocked(loadTurnstile).mockResolvedValue(turnstile.api);
    const { seen, report } = reports();
    const mount = mountBotCheck(TARGET, report);
    await settle();
    const options = turnstile.options();
    mount.unmount();
    options.callback("token-late");
    expect(turnstile.removals).toEqual(["widget-1"]);
    expect(seen).toEqual([]);
    expect(mount.reset()).toBe(false);
  });

  it("draws nothing when it is unmounted before Turnstile loads", async () => {
    const turnstile = fakeTurnstile();
    vi.mocked(loadTurnstile).mockResolvedValue(turnstile.api);
    const { seen, report } = reports();
    mountBotCheck(TARGET, report).unmount();
    await settle();
    expect(turnstile.drawn).toEqual([]);
    expect(seen).toEqual([]);
  });
});
