import { useBreakpoint, useIsClient } from "@ampm/ui";

/**
 * How hotel discovery arranges itself: `phone` (P3: the three refinement selects behind a "Filters" pill
 * and its sheet), `tablet` (the stacked filter rows, from 768) or `desktop` (D5: one search pill, one chip
 * row with the count, results two per row, from 1024).
 */
export type HotelSearchLayout = "phone" | "tablet" | "desktop";

/**
 * The arrangement for this window. A server render knows no window, so it is a phone until the client
 * takes over (ui.md: nothing that depends on the window changes the markup before hydration).
 */
export function useHotelSearchLayout(): HotelSearchLayout {
  const isClient = useIsClient();
  const { atLeast } = useBreakpoint();
  if (!isClient || !atLeast("md")) return "phone";
  return atLeast("lg") ? "desktop" : "tablet";
}
