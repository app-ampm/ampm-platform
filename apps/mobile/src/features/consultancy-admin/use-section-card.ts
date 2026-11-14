import type { CardTone } from "@ampm/ui";

import { BARE_CARD, useInDetailPanel } from "../consultancy/enquiry-surface";

/** T6's detail pane: 24 × 28 inside, radius 26, 16 between its parts; it fills its column's height. */
export const PANE_FRAME = "flex-1 gap-4 px-7 py-6 md:rounded-2xl";

export interface SectionCardLook {
  readonly tone: Extract<CardTone, "glass" | "flat">;
  readonly className: string;
}

/**
 * How a section's record card is drawn. On a phone and a tablet each is its own glass card on the page;
 * on a desktop the sections sit inside T6's one glass detail pane, where only the pane blurs and the
 * cards in it are flat tints (18 × 20 inside, as T6's proposal box). Only the props change, never the
 * element, so a form being filled in keeps what was typed when the window crosses 1024.
 */
export function useSectionCard(): SectionCardLook {
  const inPanel = useInDetailPanel();
  return inPanel
    ? { tone: "flat", className: "px-5 py-4.5" }
    : { tone: "glass", className: "md:p-7" };
}

/**
 * A frame that holds rows: a glass card on the page, nothing at all in the desktop pane, where T6 sets
 * the thread's messages straight on the panel.
 */
export function useFrameCard(): SectionCardLook {
  const inPanel = useInDetailPanel();
  return inPanel
    ? { tone: "flat", className: `${BARE_CARD} p-0` }
    : { tone: "glass", className: "md:p-7" };
}
