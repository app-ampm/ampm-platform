import { Text, useAnnounce } from "@ampm/ui";

export interface FieldAlertProps {
  readonly text: string;
  readonly testID?: string | undefined;
}

/**
 * An error under a control that is not an Input (a chip picker, a list of rows): the gold helper line an
 * Input shows (there is no red), announced when it appears or changes, as an Input's error is. A polite
 * alert: the live region speaks on Android and role alert on the web, and VoiceOver hears it through
 * `useAnnounce`, since neither speaks on iOS.
 *
 *   {errorText ? <FieldAlert text={errorText} testID="venue-setting-error" /> : null}
 */
export function FieldAlert({ text, testID }: FieldAlertProps) {
  useAnnounce(text, true);
  return (
    <Text
      variant="bodySmall"
      tone="brand"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {text}
    </Text>
  );
}
