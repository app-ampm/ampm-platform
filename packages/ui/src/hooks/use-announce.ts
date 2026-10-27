import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// Ends a sentence already, so joining parts does not add a second full stop.
const SENTENCE_END = /[.!?]$/;

/**
 * Joins a title and its body into one sentence-like announcement, skipping empty parts.
 *
 *   announcementText("You are offline", "Changes are kept.") // "You are offline. Changes are kept."
 */
export function announcementText(...parts: readonly (string | undefined)[]): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .map((part, index, all) =>
      index < all.length - 1 && !SENTENCE_END.test(part) ? `${part}.` : part,
    )
    .join(" ");
}

/**
 * Announces `message` to VoiceOver when the surface appears active, and again when the message
 * changes while it stays active; a re-render with the same message stays silent. iOS only: there
 * `accessibilityLiveRegion` does nothing and role alert or status maps to no trait, while Android
 * already speaks the live region and the web the alert or status role, so announcing there too
 * would say everything twice. The announcement is queued behind current speech, not interrupting it.
 *
 * A surface that is hidden and shown again with the same message stays silent: React's Activity
 * (expo-router screens past an activityThreshold) and development strict mode both re-run the
 * effect with the ref kept, and speaking on each re-run would repeat a state the user has heard
 * and say everything twice in development. A message that changed meanwhile is announced on show.
 *
 *   function FieldError({ text }: { text: string | undefined }) {
 *     useAnnounce(text, Boolean(text));
 *     return text ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{text}</Text> : null;
 *   }
 */
export function useAnnounce(message: string | undefined, isActive: boolean): void {
  // The last message spoken in this appearance; cleared when the surface goes inactive. No effect
  // cleanup resets it, so a hidden-then-shown Activity screen keeps it and stays silent (JSDoc).
  const spoken = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!isActive || !message) {
      spoken.current = undefined;
      return;
    }
    if (spoken.current === message) return;
    spoken.current = message;
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    }
  }, [message, isActive]);
}
