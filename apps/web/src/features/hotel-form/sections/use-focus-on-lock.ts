import { useEffect, useLayoutEffect, useRef } from "react";

import { LOCKED_HEADING_ID } from "./section-banners";

/**
 * Keeps focus off <body> as a section turns read-only under it (D-190 §5, review fix F5): a colleague
 * submitted while the person was on the section. A control focused at that moment either goes (the save
 * line's Retry, Add, Remove, Clear) or is disabled (a list, a tick, a choice, a chip), and a browser
 * then puts focus on <body> (at once for one that went, at its next frame for one disabled). Straight
 * after the render that made the section read-only, focus moves to the locked banner's heading, which
 * says why, before the browser can drop it. Focus on a field that stays focusable, or nowhere already,
 * is left where it is. When the section opens again (AMPM asked for changes, review fix F4), the banner
 * goes: focus that was on it moves to the section's own heading (`headingId`).
 *
 *   useFocusOnLock(editor.isReadOnly, SECTION_HEADING_ID);
 */
export function useFocusOnLock(isReadOnly: boolean, headingId: string): void {
  // The element focus was last on: still connected unless it went with a render.
  const last = useRef<Element | null>(null);
  useEffect(() => {
    const onIn = (event: FocusEvent) => {
      if (event.target instanceof Element) last.current = event.target;
    };
    // Focus left for nowhere (a press on the page's background): no control has it any more. A control
    // that goes with a render loses focus as it goes, so only one still there once the event is over left it.
    const onOut = (event: FocusEvent) => {
      const { target } = event;
      if (event.relatedTarget !== null || !(target instanceof Element)) return;
      queueMicrotask(() => {
        if (target.isConnected && last.current === target && isOnNothing()) last.current = null;
      });
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  useLayoutEffect(() => {
    const went = last.current !== null && !last.current.isConnected;
    const isLost = isOnNothing()
      ? went
      : isReadOnly && document.activeElement?.matches(":disabled");
    if (isLost) document.getElementById(isReadOnly ? LOCKED_HEADING_ID : headingId)?.focus();
  }, [isReadOnly, headingId]);
}

/** Whether focus is on no element: <body>, as a browser leaves it. */
function isOnNothing(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}
