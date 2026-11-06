import type { KeyDownEvent, KeyUpEvent } from "react-native";

/**
 * Keyboard handlers to spread on a Pressable; empty on native, where there is no Space key to handle.
 * React Native's key events carry the key in `nativeEvent`, as the browser's synthetic events do.
 */
export interface SpacePressProps {
  readonly onKeyDown?: (event: KeyDownEvent) => void;
  readonly onKeyUp?: (event: KeyUpEvent) => void;
}
