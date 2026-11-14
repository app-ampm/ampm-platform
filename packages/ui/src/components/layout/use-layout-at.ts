import { useBreakpoint } from "../../hooks/use-breakpoint";
import { useIsClient } from "../../hooks/use-is-client";

/** Where a layout component stops stacking: from 768 (`md`) or from 1024 (`lg`). */
export type LayoutAt = "md" | "lg";

/**
 * Whether the window is at least `at` wide. A server render knows no window, so it is a phone until
 * the client takes over (ui.md: nothing that depends on the window changes the markup before it).
 * The layout components decide with it; a screen whose own parts differ between the phone and the
 * desktop composition asks the same question, so the two never disagree:
 *
 *   const isDesktop = useLayoutAt("lg");
 */
export function useLayoutAt(at: LayoutAt): boolean {
  const isClient = useIsClient();
  const { atLeast } = useBreakpoint();
  return isClient && atLeast(at);
}
