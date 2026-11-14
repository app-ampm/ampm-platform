import { createContext, useContext } from "react";

/**
 * Where an enquiry's sections are drawn. On a phone or a tablet each one is its own glass card on the
 * page; on a desktop they all sit inside D8's one detail panel, where only that panel blurs and the
 * cards in it are flat tints (Peacock Night §3: nested items are flat, only top-level panels blur).
 */
export type EnquirySurface = "page" | "panel";

export const EnquirySurfaceContext = createContext<EnquirySurface>("page");

/** Whether the calling section sits inside the desktop detail panel: its cards go flat, nothing blurs. */
export function useInDetailPanel(): boolean {
  return useContext(EnquirySurfaceContext) === "panel";
}

/**
 * A `Card` (with `tone="flat"` and `padding="none"`) drawn as nothing: no fill, stroke, radius or clip.
 * A frame that is a card at one width and not at the other stays the same element at both, so the
 * sections in it keep their place, and their state (a typed note, an open sheet), across 1024.
 */
export const BARE_CARD = "overflow-visible rounded-none border-0 bg-transparent";

/** D8's detail panel: 28 × 32 inside, radius 28, 20 between its parts; it fills its column's height. */
export const DETAIL_PANEL = "flex-1 gap-5 px-8 py-7 md:rounded-2xl";
