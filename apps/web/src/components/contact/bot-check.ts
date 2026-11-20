import { loadTurnstile, type TurnstileApi } from "./turnstile";

/*
 * The enquiry form's bot check (PUB-06) as the form sees it: where the check stands, and the Turnstile
 * widget behind it. Framework-free, so its rules are tested without a browser; `useBotCheck` ties it
 * to the form's lifetime.
 */

/**
 * Where the bot check stands. Only `passed` carries a token, and Send works only then: a token is good
 * for one request and for 300 seconds. `failed` is a script that did not load or a check Turnstile
 * could not complete; `unsupported` is a browser Turnstile cannot run in.
 */
export type BotCheck =
  | { readonly status: "checking" }
  | { readonly status: "passed"; readonly token: string }
  | { readonly status: "failed" }
  | { readonly status: "unsupported" };

export type BotCheckStatus = BotCheck["status"];

/** The check before its first token, and after every token it drops. */
export const CHECKING: BotCheck = { status: "checking" };

/** Where the widget goes and what it checks. */
export interface BotCheckTarget {
  /** The widget's container: an element, or a selector. */
  readonly container: HTMLElement | string;
  /** The container's width in CSS pixels, which picks the widget's size. */
  readonly width: number;
  readonly siteKey: string;
}

/** One rendered widget. */
export interface BotCheckWidget {
  /** Starts a fresh check, dropping the widget's token. */
  readonly reset: () => void;
  readonly remove: () => void;
}

/** Turnstile's flexible size fills its container but needs 300px; a narrower one gets the compact widget. */
const FLEXIBLE_MIN_WIDTH = 300;

/**
 * Draws the widget and reports every change of its token: Managed mode as the site key sets it, in
 * Turnstile's dark theme (Peacock Night is dark only). An expired token, an interactive challenge
 * that timed out and an error each drop the token at once, and Turnstile's own recovery runs the
 * check again (`refresh-expired`, `refresh-timeout` and `retry` keep their `auto` defaults; after an
 * error it tries again every 8 seconds). A reset from the error callback would spin instead on an
 * error that never clears, such as a hostname the widget does not list.
 *
 *   const widget = renderBotCheck(turnstile, { container, width: 360, siteKey }, setCheck);
 */
export function renderBotCheck(
  turnstile: TurnstileApi,
  target: BotCheckTarget,
  report: (check: BotCheck) => void,
): BotCheckWidget {
  const widgetId = turnstile.render(target.container, {
    sitekey: target.siteKey,
    theme: "dark",
    size: target.width >= FLEXIBLE_MIN_WIDTH ? "flexible" : "compact",
    "response-field": false,
    callback: (token) => report({ status: "passed", token }),
    "expired-callback": () => report(CHECKING),
    "timeout-callback": () => report(CHECKING),
    "error-callback": () => {
      report({ status: "failed" });
      return true;
    },
    "unsupported-callback": () => report({ status: "unsupported" }),
  });
  return {
    reset: () => {
      if (widgetId) turnstile.reset(widgetId);
    },
    remove: () => {
      if (widgetId) turnstile.remove(widgetId);
    },
  };
}

/** A widget being put on the page. */
export interface BotCheckMount {
  /** Starts a fresh check; false while there is no widget yet (its script is loading or failed). */
  readonly reset: () => boolean;
  /** Takes the widget away; nothing is reported afterwards. */
  readonly unmount: () => void;
}

/**
 * Loads Turnstile and draws the widget in `target`, reporting where the check stands; a script that
 * does not load is a failed check.
 *
 *   const mount = mountBotCheck({ container, width: container.clientWidth, siteKey }, setCheck);
 *   mount.unmount();
 */
export function mountBotCheck(
  target: BotCheckTarget,
  report: (check: BotCheck) => void,
): BotCheckMount {
  let widget: BotCheckWidget | null = null;
  let isMounted = true;
  const update = (check: BotCheck): void => {
    if (isMounted) report(check);
  };
  loadTurnstile().then(
    (turnstile) => {
      if (isMounted) widget = renderBotCheck(turnstile, target, update);
    },
    () => update({ status: "failed" }),
  );
  return {
    reset: () => {
      widget?.reset();
      return widget !== null;
    },
    unmount: () => {
      isMounted = false;
      widget?.remove();
      widget = null;
    },
  };
}
