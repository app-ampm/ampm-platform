import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Where Tab goes inside a modal panel of `count` focusable elements: the next one, or the previous
 * one with Shift, wrapping at both ends. From outside the panel (`current` -1) it enters at the start,
 * or at the end with Shift. -1 when nothing in the panel takes focus.
 */
export function wrapFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count === 0) return -1;
  if (current === -1) return backwards ? count - 1 : 0;
  return (current + (backwards ? -1 : 1) + count) % count;
}

function trapTab(event: KeyboardEvent, panel: HTMLElement | null): void {
  if (!panel) return;
  // Only what is on screen: a panel hidden by a breakpoint (the window widened while it was open)
  // must not hold Tab captive.
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (item) => item.getClientRects().length > 0,
  );
  const current = items.findIndex((item) => item === document.activeElement);
  const next = items[wrapFocusIndex(current, items.length, event.shiftKey)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

export interface DialogFocusOptions {
  readonly isOpen: boolean;
  /** The panel that keeps focus while it is open. */
  readonly panelRef: RefObject<HTMLElement | null>;
  /** What takes focus when the panel opens (its close button). */
  readonly initialFocusRef: RefObject<HTMLElement | null>;
  /** Escape calls it; the caller closes the panel and returns focus to the control that opened it. */
  readonly onClose: () => void;
}

/**
 * Keyboard behaviour of a modal panel (the site's phone menu): focus moves in when it opens, Tab and
 * Shift+Tab stay inside it, and Escape closes it.
 *
 *   useDialogFocus({ isOpen, panelRef, initialFocusRef: closeRef, onClose: close });
 */
export function useDialogFocus({
  isOpen,
  panelRef,
  initialFocusRef,
  onClose,
}: DialogFocusOptions): void {
  useEffect(() => {
    if (!isOpen) return;
    initialFocusRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        trapTab(event, panelRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, panelRef, initialFocusRef, onClose]);
}
