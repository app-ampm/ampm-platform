import { useId, type ComponentRef, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@ampm/tokens";

import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import { FieldLabel, FieldMessage, requiredLabel, useFocused } from "./input.parts";
import {
  fieldAffixStyles,
  fieldDividerStyles,
  fieldPrefixTextStyles,
  fieldStyles,
  fieldTextStyles,
  type FieldState,
  type InputSize,
} from "./input.styles";

export interface InputProps extends Omit<TextInputProps, "editable" | "className"> {
  readonly label: string;
  readonly helpText?: string | undefined;
  /** Shown instead of the help text in gold; marks the field invalid and is announced. */
  readonly errorText?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly size?: InputSize | undefined;
  readonly leadingIcon?: IconName | undefined;
  /** Fixed text before the value, such as "+91", in pearl 60% with a divider after it. */
  readonly prefix?: string | undefined;
  readonly ref?: Ref<ComponentRef<typeof TextInput>> | undefined;
  /** Classes for the whole field block (label, frame, message). */
  readonly className?: string | undefined;
}

function FieldPrefix({ text, disabled }: { readonly text: string; readonly disabled: boolean }) {
  return (
    <View className={fieldAffixStyles}>
      <Text
        variant="body"
        tone="inherit"
        className={cn(fieldPrefixTextStyles, disabled && "text-primary/45")}
      >
        {text}
      </Text>
      <View className={fieldDividerStyles} />
    </View>
  );
}

interface TextFieldProps extends Omit<
  InputProps,
  "helpText" | "errorText" | "required" | "className" | "size" | "leadingIcon" | "prefix"
> {
  readonly labelId: string;
  /** Set while a help or error message is shown, so the input can point at it. */
  readonly messageId: string | undefined;
  readonly hasError: boolean;
  readonly disabled: boolean;
  readonly required: boolean;
}

/**
 * The text input itself: labelled by the label, described by the message, pearl on midnight. A
 * required field is named "…, required" on iOS and Android and is aria-required on the web, where
 * the label element names it (aria-labelledby wins over the accessibilityLabel there).
 */
function FieldTextInput({
  label,
  labelId,
  messageId,
  hasError,
  disabled,
  required,
  multiline,
  accessibilityLabel,
  ...rest
}: TextFieldProps) {
  const { resolved } = useTheme();
  return (
    <TextInput
      className={fieldTextStyles({ disabled, multiline: multiline === true })}
      multiline={multiline}
      placeholderTextColor={colors.muted[resolved]}
      selectionColor={colors.brand[resolved]}
      editable={!disabled}
      accessibilityLabel={accessibilityLabel ?? requiredLabel(label, required)}
      accessibilityLabelledBy={labelId}
      accessibilityState={{ disabled }}
      aria-invalid={hasError}
      aria-required={required}
      {...(messageId ? { "aria-describedby": messageId } : {})}
      {...rest}
    />
  );
}

interface ControlProps extends TextFieldProps {
  readonly size: InputSize;
  readonly leadingIcon: IconName | undefined;
  readonly prefix: string | undefined;
}

function fieldState(disabled: boolean, hasError: boolean, focused: boolean): FieldState {
  if (disabled) return "disabled";
  if (hasError) return "error";
  return focused ? "focused" : "default";
}

/** The frame with the optional icon or prefix and the text input; owns the focus state. */
function FieldControl({ size, leadingIcon, prefix, onFocus, onBlur, ...input }: ControlProps) {
  const focus = useFocused(onFocus, onBlur);
  const isMultiline = input.multiline === true;
  const state = fieldState(input.disabled, input.hasError, focus.focused);
  return (
    <View className={fieldStyles({ state, size, multiline: isMultiline })}>
      {leadingIcon ? (
        // On a multiline field the icon lines up with the first line of text, not the middle.
        <Icon name={leadingIcon} tone="muted" className={isMultiline ? "mt-4" : undefined} />
      ) : null}
      {prefix ? <FieldPrefix text={prefix} disabled={input.disabled} /> : null}
      <FieldTextInput {...input} onFocus={focus.handleFocus} onBlur={focus.handleBlur} />
    </View>
  );
}

/**
 * A labelled text field in Peacock Night: a midnight pill with a pearl 20% stroke; focus is a gold
 * stroke plus the gold halo; an error turns the stroke and the message under the field gold (no red)
 * and the field keeps what was typed; disabled is a dashed stroke with pearl 45% text. Multiline
 * fields take radius 22 and a taller minimum. The error should name the field ("Enter a 10-digit
 * mobile number").
 *
 * The label is tied to the input for screen readers; the error is a live region and is announced on
 * iOS (useAnnounce), unless the field's className hides the whole block (isHiddenFromVoiceOver).
 * Only className hides the whole field: `style`, `aria-hidden` and `accessibilityElementsHidden` go
 * to the text input alone, so the label and the error stay reachable and the error is still spoken.
 * A hidden ancestor is not seen, so render a hidden form step conditionally. Every state keeps the
 * 44px target.
 *
 *   <Input label="Mobile number" prefix="+91" keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
 *   <Input label="Email" keyboardType="email-address" value={email} onChangeText={setEmail} errorText={errors.email} />
 *   <Input label="Anything else we should know?" multiline value={notes} onChangeText={setNotes} />
 */
export function Input({
  label,
  helpText,
  errorText,
  disabled = false,
  required = false,
  size = "md",
  leadingIcon,
  prefix,
  className,
  ...control
}: InputProps) {
  const labelId = useId();
  const messageId = useId();
  const message = errorText ?? helpText;
  const hasError = Boolean(errorText);
  // Only className reaches the whole block; the other props stop at the text input, leaving the
  // label and the error message reachable, so they do not silence the error.
  const isHidden = isHiddenFromVoiceOver({ className });
  return (
    <View className={cn("gap-2", className)}>
      <FieldLabel id={labelId} label={label} required={required} disabled={disabled} />
      <FieldControl
        {...control}
        label={label}
        labelId={labelId}
        messageId={message ? messageId : undefined}
        hasError={hasError}
        disabled={disabled}
        required={required}
        size={size}
        leadingIcon={leadingIcon}
        prefix={prefix}
      />
      <FieldMessage id={messageId} text={message} isError={hasError} isHidden={isHidden} />
    </View>
  );
}
