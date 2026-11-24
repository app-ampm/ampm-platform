import { Platform, Pressable, View } from "react-native";

import { cn, groupFocusRingStyles, requiredLabel, Row, Stack, Text } from "@ampm/ui";

import { FieldAlert } from "./field-alert";

export interface MediaOptionPickerProps<T extends string> {
  readonly label: string;
  /** The chosen option, or null while none is chosen yet. */
  readonly value: T | null;
  readonly options: readonly T[];
  readonly optionLabel: (option: T) => string;
  readonly onChange: (option: T) => void;
  /** Shown under the chips in gold, and announced, after a save the checks blocked. */
  readonly errorText?: string | undefined;
  /** A choice a save needs (a venue's setting): marked as a required Input is. */
  readonly required?: boolean | undefined;
  readonly testID?: string | undefined;
}

interface OptionChipProps {
  readonly text: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string | undefined;
}

/** One radio: a 44px pill, peacock when chosen, the gold ring while it has keyboard focus. */
function OptionChip({ text, selected, onPress, testID }: OptionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      // A radio's state is `checked` (native) / `aria-checked` (web; react-native-web drops
      // `accessibilityState`), not `selected`.
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={text}
      className="group web:outline-none"
      testID={testID}
    >
      <View
        className={cn(
          "min-h-touch min-w-touch items-center justify-center rounded-full border px-3 py-1.5",
          selected ? "border-highlight/70 bg-highlight/30" : "border-primary/16",
          groupFocusRingStyles,
        )}
      >
        <Text variant="bodySmall" tone={selected ? "primary" : "muted"}>
          {text}
        </Text>
      </View>
    </Pressable>
  );
}

interface PickerLabelProps {
  readonly label: string;
  /** What a screen reader calls the group: the label, or "…, required" on native. */
  readonly name: string;
  readonly required: boolean;
}

/** The group's eyebrow label; a required group's asterisk is drawn only, never read as "star". */
function PickerLabel({ label, name, required }: PickerLabelProps) {
  return (
    <Text variant="eyebrow" tone="muted" {...(name === label ? {} : { accessibilityLabel: name })}>
      {label}
      {required ? <Text aria-hidden>{" *"}</Text> : null}
    </Text>
  );
}

/**
 * A small single-select of one of a short list (a photo's visibility or rights, a venue's type and
 * setting, a room's unit type): a labelled radio group of 44px chips, the chosen one in peacock. The
 * selected state is exposed with `aria-checked` so assistive tech reads it on the web workspace. An
 * error shows under the chips, as under an Input. A required group is marked as a required Input is: an
 * asterisk drawn for the eye, "…, required" on iOS and Android, `aria-required` on the web, where the
 * name stays the label alone so it is not said twice.
 */
export function MediaOptionPicker<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
  errorText,
  required = false,
  testID,
}: MediaOptionPickerProps<T>) {
  const name = Platform.OS === "web" ? label : requiredLabel(label, required);
  return (
    <Stack gap={2}>
      <PickerLabel label={label} name={name} required={required} />
      <Row
        gap={2}
        wrap
        accessibilityRole="radiogroup"
        accessibilityLabel={name}
        aria-required={required}
        testID={testID}
      >
        {options.map((option) => (
          <OptionChip
            key={option}
            text={optionLabel(option)}
            selected={option === value}
            onPress={() => onChange(option)}
            testID={testID ? `${testID}-${option}` : undefined}
          />
        ))}
      </Row>
      {errorText ? (
        <FieldAlert text={errorText} testID={testID ? `${testID}-error` : undefined} />
      ) : null}
    </Stack>
  );
}
