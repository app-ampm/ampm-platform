/**
 * Toasts float at the top of the screen, 8 under the status bar (the viewport's `top` is the safe-area
 * inset), inside the phone gutter (18), stacked newest first. Never part of the layout, so the
 * viewport is absolute and lets touches through.
 */
export const toastViewportStyles =
  "absolute inset-x-0 top-0 z-toast items-center gap-2 px-4.5 pt-2";

/** The card's width: the full gutter on a phone, at most 448 on a tablet or desktop. */
export const toastFrameStyles = "w-full max-w-md";

/**
 * The card on its glass (base recipe, a phone card's radius 22). No stroke accent and no shadow: the
 * icon carries the tone.
 */
export const toastStyles = "rounded-lg py-3 pl-4 pr-1";

/** The card's row, the part that fades in: the tone icon, the text, and the dismiss button at the end. */
export const toastRowStyles = "flex flex-row items-start gap-3";
