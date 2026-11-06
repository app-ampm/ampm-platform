import { useState } from "react";
import { Platform } from "react-native";

import { uiCopy } from "../../copy";
import { useAnnounce } from "../../hooks/use-announce";
import { Text } from "../text";

/**
 * The pieces every Peacock Night form control shares (Input, OtpInput, Checkbox): the label above,
 * the help or error line below, and the focus state that drives the gold stroke on native. Internal
 * to the form components; the website reuses the classes in input.styles.ts instead.
 */

interface FieldLabelProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
}

/** "Work email, required": a required field's name, so its asterisk is never read as "star". */
export function requiredLabel(label: string, required: boolean): string {
  return required ? `${label}, ${uiCopy.required}` : label;
}

/**
 * Manrope 600 13 in pearl 80% (pearl 45% while disabled); its id labels the control. A required
 * field's asterisk is drawn for the eye: native screen readers read the label as "…, required", and
 * the web, where the control is named from this text (aria-labelledby), skips the hidden asterisk
 * while the control itself says it is required (aria-required).
 */
export function FieldLabel({ id, label, required = false, disabled = false }: FieldLabelProps) {
  const spoken =
    required && Platform.OS !== "web" ? { accessibilityLabel: requiredLabel(label, true) } : {};
  return (
    <Text variant="label" tone={disabled ? "disabled" : "body"} nativeID={id} {...spoken}>
      {label}
      {required ? <Text aria-hidden>{" *"}</Text> : null}
    </Text>
  );
}

interface FieldMessageProps {
  readonly id: string;
  readonly text: string | undefined;
  readonly isError: boolean;
  /** Set while the control's className hides the whole block, so the error is not spoken. */
  readonly isHidden: boolean;
}

/**
 * The line under a control: help in pearl 58%, or the error in gold (there is no red). The error is
 * an alert and a live region (Android, the web) and is announced on iOS, where neither speaks.
 */
export function FieldMessage({ id, text, isError, isHidden }: FieldMessageProps) {
  useAnnounce(text, isError && !isHidden);
  if (!text) return null;
  return (
    <Text
      variant="bodySmall"
      tone={isError ? "brand" : "muted"}
      nativeID={id}
      accessibilityLiveRegion={isError ? "polite" : "none"}
      {...(isError ? { accessibilityRole: "alert" as const } : {})}
    >
      {text}
    </Text>
  );
}

type FocusHandler<Event> = ((event: Event) => void) | null | undefined;

/** Tracks focus for the visual state; the caller's own handlers still run. */
export function useFocused<Event>(onFocus: FocusHandler<Event>, onBlur: FocusHandler<Event>) {
  const [focused, setFocused] = useState(false);
  const handleFocus = (event: Event) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: Event) => {
    setFocused(false);
    onBlur?.(event);
  };
  return { focused, handleFocus, handleBlur };
}
