/*
 * Cloudflare Turnstile, the enquiry form's bot check (PUB-06, D-145; security.md: "a bot check on
 * public forms"). A hand-written loader and the slice of Turnstile's explicit-render API the form
 * calls, in place of a wrapper package (code.md: no dependency without asking). The script comes
 * straight from Cloudflare, which requires its exact URL (no proxy, no copy), and only on the page that
 * draws the widget; the CSP admits its origin (middleware.ts). The API checks each token with Cloudflare.
 */

/** Turnstile's origin: its script, and the iframe its challenge runs in. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Explicit rendering: a widget appears only where `turnstile.render` puts one. */
export const TURNSTILE_SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

/** The render parameters the form sets, under Turnstile's own names; the rest keep their defaults. */
export interface TurnstileRenderOptions {
  readonly sitekey: string;
  readonly theme: "light" | "dark" | "auto";
  readonly size: "normal" | "flexible" | "compact";
  /** False: the token reaches the form through `callback`, never through a hidden input. */
  readonly "response-field": boolean;
  readonly callback: (token: string) => void;
  readonly "expired-callback": () => void;
  readonly "timeout-callback": () => void;
  /** Returning true tells Turnstile the error is handled: no exception, no console warning. */
  readonly "error-callback": (code: string | number) => boolean;
  readonly "unsupported-callback": () => void;
}

/** The slice of `window.turnstile` the form calls. */
export interface TurnstileApi {
  /** Draws a widget in the container (an element or a selector) and returns its id. */
  render(
    container: HTMLElement | string,
    options: TurnstileRenderOptions,
  ): string | null | undefined;
  /** Starts a fresh check, dropping the widget's token. */
  reset(widgetId: string): void;
  /** Takes the widget off the page; it calls nothing back afterwards. */
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi | undefined;
  }
}

let loading: Promise<TurnstileApi> | undefined;

/**
 * Turnstile's API, adding its script to the page the first time. Calls made while it loads share that
 * script; a failed load is forgotten, so the next call (the form's "Try again") fetches it afresh.
 *
 *   const turnstile = await loadTurnstile();
 *   const widgetId = turnstile.render(container, options);
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  const loaded = window.turnstile;
  if (loaded) return Promise.resolve(loaded);
  loading ??= addScript().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** Appends Turnstile's script; resolves with its API once it has run, or removes it and rejects. */
function addScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = (reason: string): void => {
      script.remove();
      reject(new Error(reason));
    };
    script.addEventListener("load", () => {
      const api = window.turnstile;
      if (api) resolve(api);
      else fail("Turnstile's script ran without its API");
    });
    script.addEventListener("error", () => fail("Turnstile's script did not load"));
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    document.head.append(script);
  });
}
