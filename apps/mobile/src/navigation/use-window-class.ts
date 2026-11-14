import { useBreakpoint, useIsClient } from "@ampm/ui";

/**
 * The admin workspace keeps the rail's labels from 1200 up and folds it to icons between 768 and
 * 1199 (docs/design/peacock-night.md §7); this width is the guide's, not a token breakpoint.
 */
const EXPANDED_RAIL_FROM = 1200;

export interface WindowClass {
  /** 768 and wider: the layout draws the rail or the top navigation, and screens get no tab bar. */
  readonly isWide: boolean;
  /** 1024 and wider: the desktop artboards (D, T); the client bar has room for the avatar. */
  readonly isDesktop: boolean;
  /** 1200 and wider: the staff rail shows its labels. */
  readonly isRailExpanded: boolean;
}

/**
 * How the window lays out the app's navigation. The server knows no window, so a web render is a
 * phone until hydration (ui.md: nothing that depends on the window changes the markup before it).
 */
export function useWindowClass(): WindowClass {
  const isClient = useIsClient();
  const { atLeast, width } = useBreakpoint();
  const isWide = isClient && atLeast("md");
  const isDesktop = isClient && atLeast("lg");
  return { isWide, isDesktop, isRailExpanded: isWide && width >= EXPANDED_RAIL_FROM };
}
