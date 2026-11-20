import { Text, useAnnounce } from "@ampm/ui";

/**
 * An error that answers an action, in gold under it (Peacock Night has no red). A polite alert, as the
 * fields' own error lines are: the live region speaks on Android, role alert on the web, and VoiceOver
 * hears it through `useAnnounce`, since neither speaks on iOS.
 *
 *   <InlineAlert text={step.sendError} />
 */
export function InlineAlert({ text }: { readonly text: string | undefined }) {
  useAnnounce(text, Boolean(text));
  if (!text) return null;
  return (
    <Text
      variant="bodySmall"
      tone="brand"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}
