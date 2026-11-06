import { useId, type ComponentRef, type Ref } from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { announcementText } from "../../hooks/use-announce";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { spacePress } from "../../lib/space-press";
import { Icon } from "../icon";
import { FieldMessage } from "../input/input.parts";
import { Text } from "../text";
import { checkboxBoxStyles, checkboxRowStyles, checkboxTextStyles } from "./checkbox.styles";

export interface CheckboxProps extends Omit<
  PressableProps,
  | "children"
  | "disabled"
  | "style"
  | "onPress"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-checked"
  | "aria-disabled"
> {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** Manrope 13 in pearl 80%, beside the box; also the name screen readers hear. */
  readonly label: string;
  /** A line under the label in pearl 58%. */
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Turns the box's stroke gold and shows the message in gold under the label; announced. */
  readonly errorText?: string | undefined;
  readonly ref?: Ref<ComponentRef<typeof Pressable>> | undefined;
  /** Classes for the whole block (the row and its message). */
  readonly className?: string;
}

interface BoxProps {
  readonly checked: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
  readonly testID: string | undefined;
}

function CheckboxBox({ checked, invalid, disabled, testID }: BoxProps) {
  return (
    <View
      className={checkboxBoxStyles({ checked, invalid, disabled })}
      testID={testID ? `${testID}-box` : undefined}
    >
      {checked ? <Icon name="check" size="sm" tone="onHighlight" /> : null}
    </View>
  );
}

interface TextProps {
  readonly label: string;
  readonly description: string | undefined;
  readonly descriptionId: string;
  readonly disabled: boolean;
}

function CheckboxText({ label, description, descriptionId, disabled }: TextProps) {
  return (
    <View className={checkboxTextStyles}>
      <Text variant="bodySmall" tone={disabled ? "disabled" : "body"}>
        {label}
      </Text>
      {description ? (
        <Text variant="bodySmall" tone={disabled ? "disabled" : "muted"} nativeID={descriptionId}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

/** The error under the label: a spacer as wide as the box keeps it in line with the label. */
interface ErrorProps {
  readonly id: string;
  readonly text: string;
  readonly isHidden: boolean;
}

function CheckboxError({ id, text, isHidden }: ErrorProps) {
  return (
    <View className="flex-row gap-3">
      <View className="w-5.5" />
      <View className="flex-1">
        <FieldMessage id={id} text={text} isError isHidden={isHidden} />
      </View>
    </View>
  );
}

interface RowProps extends Omit<CheckboxProps, "className"> {
  readonly descriptionId: string;
  readonly messageId: string;
}

type RowAccessibilityInput = Pick<
  RowProps,
  | "checked"
  | "label"
  | "accessibilityLabel"
  | "description"
  | "errorText"
  | "descriptionId"
  | "messageId"
> & { readonly disabled: boolean };

/**
 * What screen readers hear: a checkbox and its state, named by the label, then error and description.
 * The state is aria-*, not accessibilityState: React Native maps it to the native state, and
 * react-native-web (which drops accessibilityState) writes it for the browser.
 */
function rowAccessibility(row: RowAccessibilityInput) {
  const { checked, disabled, description, errorText } = row;
  const describedBy = [description && row.descriptionId, errorText && row.messageId].filter(
    Boolean,
  );
  return {
    accessibilityRole: "checkbox" as const,
    "aria-checked": checked,
    "aria-disabled": disabled,
    accessibilityLabel: row.accessibilityLabel ?? row.label,
    accessibilityHint: announcementText(errorText, description) || undefined,
    "aria-invalid": Boolean(errorText),
    ...(describedBy.length > 0 ? { "aria-describedby": describedBy.join(" ") } : {}),
  };
}

/** The pressable row: the box, then the label and description. */
function CheckboxRow({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  errorText,
  accessibilityLabel,
  testID,
  descriptionId,
  messageId,
  ...rest
}: RowProps) {
  const spoken = { checked, disabled, label, accessibilityLabel, description, errorText };
  const toggle = () => onCheckedChange(!checked);
  return (
    <Pressable
      {...rowAccessibility({ ...spoken, descriptionId, messageId })}
      {...spacePress(disabled ? undefined : toggle)}
      {...rest}
      disabled={disabled}
      onPress={toggle}
      className={checkboxRowStyles({ disabled })}
      testID={testID}
    >
      <CheckboxBox {...{ checked, disabled, testID }} invalid={Boolean(errorText)} />
      <CheckboxText {...{ label, description, descriptionId, disabled }} />
    </Pressable>
  );
}

/**
 * A tick box in Peacock Night: 22 at radius 7, peacock with a midnight check when ticked, a pearl 34%
 * stroke when not, the label beside it in pearl 80%. An error turns the stroke and a message under
 * the label gold (there is no red) and is announced. The whole row is the target, at least 44 tall;
 * screen readers hear a checkbox with its state, the description and the error; the web shows the
 * gold halo on keyboard focus.
 *
 *   <Checkbox label="I'd like a demo of hotel discovery" checked={demo} onCheckedChange={setDemo} />
 *   <Checkbox label="I've read the privacy notice" checked={consent} onCheckedChange={setConsent} errorText={errors.consent} />
 */
export function Checkbox({ className, ...row }: CheckboxProps) {
  const descriptionId = useId();
  const messageId = useId();
  return (
    <View className={cn("gap-1", className)}>
      <CheckboxRow {...row} descriptionId={descriptionId} messageId={messageId} />
      {row.errorText ? (
        <CheckboxError
          id={messageId}
          text={row.errorText}
          isHidden={isHiddenFromVoiceOver({ className })}
        />
      ) : null}
    </View>
  );
}
