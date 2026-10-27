import { useWindowDimensions } from "react-native";

import { breakpoints } from "@ampm/tokens";

/** `base` below 768 (phone), `md` and `lg` tablets and narrow windows, `xl` desktop (wireframes W-3). */
export type Breakpoint = "base" | "md" | "lg" | "xl";

const ORDER: readonly Breakpoint[] = ["base", "md", "lg", "xl"];

export interface BreakpointInfo {
  readonly breakpoint: Breakpoint;
  readonly width: number;
  readonly isPhone: boolean;
  readonly isTablet: boolean;
  readonly isDesktop: boolean;
  /** `atLeast("md")` is true on md, lg and xl. */
  readonly atLeast: (breakpoint: Breakpoint) => boolean;
}

export function breakpointFor(width: number): Breakpoint {
  if (width >= breakpoints.xl) return "xl";
  if (width >= breakpoints.lg) return "lg";
  if (width >= breakpoints.md) return "md";
  return "base";
}

/**
 * The layout step for the current window, from the tokens' breakpoints. Native layouts branch on
 * this; the web adds `md:` and `lg:` classes on top (styling.md).
 */
export function useBreakpoint(): BreakpointInfo {
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  return {
    breakpoint,
    width,
    isPhone: breakpoint === "base",
    isTablet: breakpoint === "md" || breakpoint === "lg",
    isDesktop: breakpoint === "xl",
    atLeast: (target) => ORDER.indexOf(breakpoint) >= ORDER.indexOf(target),
  };
}
