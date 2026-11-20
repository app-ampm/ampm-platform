import { useCallback, useEffect, useRef, useState } from "react";

import { CHECKING, mountBotCheck, type BotCheck, type BotCheckMount } from "./bot-check";

/** The bot check as the enquiry form uses it. */
export interface BotCheckControl {
  /** Give it to the widget container's `ref`: the widget lives exactly as long as that element. */
  readonly ref: (element: HTMLDivElement | null) => void;
  readonly check: BotCheck;
  /** The token Send carries, or null while there is none. */
  readonly token: string | null;
  /** Starts a fresh check: once a token has been sent, and on the failure notice's "Try again". */
  readonly reset: () => void;
}

/**
 * Cloudflare Turnstile in the element given to `ref`, and the token it holds (PUB-06). The widget is
 * drawn when the form appears and removed when the confirmation replaces it, so a form brought back
 * (a demo link followed on /contact) gets a widget, and a token, of its own.
 *
 *   const botCheck = useBotCheck(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
 *   <div ref={botCheck.ref} />
 */
export function useBotCheck(siteKey: string): BotCheckControl {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [check, setCheck] = useState<BotCheck>(CHECKING);
  // Counts the reloads asked for after the script failed to load: there is no widget to reset then.
  const [reloads, setReloads] = useState(0);
  const mount = useRef<BotCheckMount | null>(null);

  useEffect(() => {
    if (!container) return undefined;
    const current = mountBotCheck({ container, width: container.clientWidth, siteKey }, setCheck);
    mount.current = current;
    return () => {
      current.unmount();
      mount.current = null;
      // No widget, no token: whatever comes next starts from a fresh check.
      setCheck(CHECKING);
    };
  }, [container, siteKey, reloads]);

  const reset = useCallback(() => {
    setCheck(CHECKING);
    if (!mount.current?.reset()) setReloads((count) => count + 1);
  }, []);

  return { ref: setContainer, check, token: check.status === "passed" ? check.token : null, reset };
}
