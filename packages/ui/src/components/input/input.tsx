import { useId, useState, type ComponentRef, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import { fieldStyles, type InputSize } from "./input.styles";

export interface InputProps extends Omit<TextInputProps, "editable" | "className"> {
  readonly label: string;
  readonly helpText?: string | undefined;
  /** Shown instead of the help text; marks the field invalid and is announced. */
  readonly errorText?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly size?: InputSize | undefined;
  readonly leadingIcon?: IconName | undefined;
  readonly ref?: Ref<ComponentRef<typeof TextInput>> | undefined;
  /** Classes for the whole field block (label, frame, message). */
  readonly className?: string | undefined;
}

interface MessageProps {
  readonly id: string;
  readonly text: string | undefined;
  readonly isError: boolean;
}

function FieldMessage({ id, text, isError }: MessageProps) {
  if (!text) return null;
  return (
    <Text
      variant="caption"
      tone={isError ? "danger" : "muted"}
      nativeID={id}
      accessibilityLiveRegion={isError ? "polite" : "none"}
      {...(isError ? { accessibilityRole: "alert" as const } : {})}
    >
      {text}
    </Text>
  );
}

/**
 * A labelled text field. States: default, focused, error, disabled. The label is tied to the input
 * for screen readers; the error is a live region. Every state keeps the 44px target.
 *
 *   <Input label="Email" keyboardType="email-address" value={email} onChangeText={setEmail} errorText={errors.email} />
 */
export function Input({
  label,
  helpText,
  errorText,
  disabled = false,
  required = false,
  size = "md",
  leadingIcon,
  ref,
  className,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { resolved } = useTheme();
  const [focused, setFocused] = useState(false);
  const labelId = useId();
  const messageId = useId();
  const state = disabled ? "disabled" : errorText ? "error" : focused ? "focused" : "default";
  const message = errorText ?? helpText;

  return (
    <View className={cn("gap-1", className)}>
      <Text variant="label" tone={disabled ? "muted" : "primary"} nativeID={labelId}>
        {label}
        {required ? " *" : ""}
      </Text>
      <View className={fieldStyles({ state, size })}>
        {leadingIcon ? <Icon name={leadingIcon} tone="muted" /> : null}
        <TextInput
          ref={ref}
          className="flex-1 py-2 font-sans text-base text-primary web:outline-none"
          placeholderTextColor={colors.muted[resolved]}
          selectionColor={colors.brand[resolved]}
          editable={!disabled}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityLabelledBy={labelId}
          accessibilityState={{ disabled }}
          aria-invalid={Boolean(errorText)}
          {...(message ? { "aria-describedby": messageId } : {})}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
      </View>
      <FieldMessage id={messageId} text={message} isError={Boolean(errorText)} />
    </View>
  );
}
