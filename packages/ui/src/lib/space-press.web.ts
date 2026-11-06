import type { KeyDownEvent, KeyUpEvent } from "react-native";

import type { SpacePressProps } from "./space-press.types";

export type { SpacePressProps } from "./space-press.types";

const SPACE = " ";

/**
 * Space for a Pressable that is not a button. react-native-web's Pressable presses on Enter for every
 * role but on Space only for a <button> or role button, while a switch, a checkbox or a tab renders as a
 * <div> with that role, so Space would scroll the page instead (APG: Space toggles a switch or a
 * checkbox and activates a tab). The key is taken on its way down, so the page does not scroll, and acts
 * on its way up, like a native control, so holding it down acts once. Pass undefined while disabled.
 *
 *   <Pressable accessibilityRole="switch" {...spacePress(disabled ? undefined : toggle)} onPress={toggle} />
 */
export function spacePress(onPress: (() => void) | undefined): SpacePressProps {
  if (!onPress) return {};
  return {
    onKeyDown: (event: KeyDownEvent) => {
      if (event.nativeEvent.key === SPACE) event.preventDefault();
    },
    onKeyUp: (event: KeyUpEvent) => {
      if (event.nativeEvent.key !== SPACE) return;
      event.preventDefault();
      onPress();
    },
  };
}
