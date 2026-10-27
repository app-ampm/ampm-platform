import { StyleSheet, type ViewProps } from "react-native";

/** The view props that keep a surface from VoiceOver: hidden from it, or not displayed at all. */
export interface VoiceOverHiding {
  readonly accessibilityElementsHidden?: ViewProps["accessibilityElementsHidden"];
  readonly "aria-hidden"?: ViewProps["aria-hidden"];
  readonly style?: ViewProps["style"];
  readonly className?: string | undefined;
}

// A breakpoint that displays the view again ("hidden md:flex") leaves its visibility to the width.
const SHOWN_AT_BREAKPOINT =
  /^[a-z0-9]+:(flex|block|inline|inline-block|inline-flex|grid|contents)$/;

function isClassHidden(className: string | undefined): boolean {
  const tokens = className?.split(/\s+/) ?? [];
  return tokens.includes("hidden") && !tokens.some((token) => SHOWN_AT_BREAKPOINT.test(token));
}

/**
 * True when the view's own props keep it and its content from VoiceOver, so a surface that
 * announces itself on iOS stays silent instead of speaking text the user cannot reach: hidden from
 * the accessibility tree (`accessibilityElementsHidden`, `aria-hidden`) or not displayed (a
 * display-none style, a bare `hidden` class). `importantForAccessibility` is Android-only and does
 * not count. A hidden ancestor, or `hidden` undone at a breakpoint, is not visible here; render the
 * surface conditionally instead.
 *
 *   useAnnounce(text, isLive && !isHiddenFromVoiceOver({ ...viewProps, className }));
 */
export function isHiddenFromVoiceOver(props: VoiceOverHiding): boolean {
  return (
    props.accessibilityElementsHidden === true ||
    props["aria-hidden"] === true ||
    StyleSheet.flatten(props.style)?.display === "none" ||
    isClassHidden(props.className)
  );
}
