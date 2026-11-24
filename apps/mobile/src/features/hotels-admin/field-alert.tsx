import { Text } from "@ampm/ui";

export interface FieldAlertProps {
  readonly text: string;
  readonly testID?: string | undefined;
}

/**
 * An error under a control that is not an Input (a chip picker, a list of rows): the gold helper line an
 * Input shows (there is no red), announced as an alert when it appears.
 *
 *   {errorText ? <FieldAlert text={errorText} testID="venue-setting-error" /> : null}
 */
export function FieldAlert({ text, testID }: FieldAlertProps) {
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
