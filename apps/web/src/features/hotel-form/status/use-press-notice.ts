import { useState } from "react";

import type { PressRefusal } from "./status.form";

/*
 * The answer to a press on HF-07 (a correction sent, a permission withdrawn, or why not), as a notice that
 * takes focus each time it is shown; a 429's wait holds the press back until it is over.
 */

/** What a press's notice says: done (peacock), refused (gold), or a wait before trying again. */
export type PressNotice =
  | { readonly kind: "done" | "refused"; readonly message: string }
  | { readonly kind: "wait"; readonly message: string; readonly retryAt: number };

/** A notice as shown: each showing is counted, so it takes focus every time, a repeat too. */
export type ShownPressNotice = PressNotice & { readonly shown: number };

/** A refusal the page shows itself (the flow takes a session's) as its notice. */
export function pressNoticeOf(refusal: Exclude<PressRefusal, { readonly kind: "session" }>) {
  return refusal.kind === "wait"
    ? refusal
    : ({ kind: "refused", message: refusal.message } satisfies PressNotice);
}

/**
 * A press's notice: `show` counts each showing; `isHeld` says a wait the API asked for is not over yet,
 * when pressing again only shows the wait again.
 *
 *   const notice = usePressNotice();
 *   if (notice.isHeld()) return notice.show(notice.current);
 */
export function usePressNotice() {
  const [current, setCurrent] = useState<ShownPressNotice | null>(null);
  const show = (next: PressNotice) =>
    setCurrent((shown) => ({ ...next, shown: (shown?.shown ?? 0) + 1 }));
  const isHeld = (): boolean => current?.kind === "wait" && current.retryAt > Date.now();
  return { current, show, isHeld, clear: () => setCurrent(null) };
}
