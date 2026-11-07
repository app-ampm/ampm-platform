import type { SpacePressProps } from "./space-press.types";

export type { SpacePressProps } from "./space-press.types";

const NONE: SpacePressProps = {};

/**
 * Native: nothing to add. Switches, checkboxes and tabs are pressed by touch and screen reader
 * gestures there; the web needs the Space key wired up by hand (space-press.web.ts).
 *
 *   <Pressable accessibilityRole="switch" {...spacePress(toggle)} onPress={toggle} />
 */
export function spacePress(_onPress: (() => void) | undefined): SpacePressProps {
  return NONE;
}
