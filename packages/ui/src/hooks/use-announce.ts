import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform, type AccessibilityProps } from "react-native";

import { announcePolitely } from "../lib/live-region";

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

export interface AnnounceOptions {
  /**
   * Speak on the web too, through the page's one polite live region (lib/live-region). For polite
   * notices that appear already filled (a toast, the offline banner, an offline or pending-sync
   * callout, the offline state): a live region inserted together with its text is not reliably
   * spoken, so they carry no live region of their own on the web (`politeLiveRegion`). Leave it off
   * where role alert speaks on the web (errors), or the words would be said twice.
   */
  readonly web?: boolean | undefined;
}

/**
 * Announces `message` when the surface appears active, and again when the message changes while it
 * stays active; a re-render with the same message stays silent. iOS always: there
 * `accessibilityLiveRegion` does nothing and role alert or status maps to no trait. The web with
 * `{ web: true }` (AnnounceOptions). Never on Android, where the notice's own live region speaks
 * (`politeLiveRegion`), so announcing as well would say everything twice. The announcement is queued
 * behind current speech, not interrupting it.
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
 *   useAnnounce(announcementText(title, body), isVisible, { web: true });
 */
export function useAnnounce(
  message: string | undefined,
  isActive: boolean,
  { web = false }: AnnounceOptions = {},
): void {
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
    } else if (web && Platform.OS === "web") {
      announcePolitely(message);
    }
  }, [message, isActive, web]);
}

/**
 * A polite notice's own live region, on the one platform where it is what speaks: Android, where
 * TalkBack reads a live region's changes. iOS ignores live regions (useAnnounce speaks there), and
 * on the web the notice speaks through the page's live region instead (`useAnnounce` with
 * `{ web: true }`), so carrying its own there would say it twice.
 *
 *   <GlassPanel recipe="peacock" {...politeLiveRegion()}>…</GlassPanel>
 */
export function politeLiveRegion(): Pick<AccessibilityProps, "accessibilityLiveRegion"> {
  return Platform.OS === "android" ? { accessibilityLiveRegion: "polite" } : {};
}
