import type { AccessibilityProps } from "react-native";

/** The view props that take a surface and its content out of the accessibility tree. */
export type AccessibilityHiding = Pick<
  AccessibilityProps,
  "accessibilityElementsHidden" | "importantForAccessibility" | "aria-hidden"
>;

/**
 * True when the view's own props hide it and its content from screen readers, so a surface that
 * announces itself stays silent: VoiceOver would otherwise speak text the user cannot reach.
 * `importantForAccessibility="no"` hides the view alone, not its content, so it does not count.
 * A hidden ancestor (or a display-none wrapper) is not visible here; render the surface
 * conditionally instead of hiding it.
 *
 *   useAnnounce(text, isLive && !isHiddenFromAccessibility(viewProps));
 */
export function isHiddenFromAccessibility(props: AccessibilityHiding): boolean {
  return (
    props.accessibilityElementsHidden === true ||
    props.importantForAccessibility === "no-hide-descendants" ||
    props["aria-hidden"] === true
  );
}
