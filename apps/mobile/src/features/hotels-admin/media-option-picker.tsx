import { Pressable, View } from "react-native";

import { Row, Stack, Text } from "@ampm/ui";

export interface MediaOptionPickerProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly optionLabel: (option: T) => string;
  readonly onChange: (option: T) => void;
  readonly testID?: string | undefined;
}

/**
 * A small single-select of a photo's visibility or rights: a labelled row of chips, the chosen one in
 * peacock. A radio group — `aria-expanded` has no bearing, but the selected state is exposed with
 * `aria-checked` (react-native-web drops `accessibilityState`) so assistive tech reads it on the web
 * workspace.
 */
export function MediaOptionPicker<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
  testID,
}: MediaOptionPickerProps<T>) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Row gap={2} wrap accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              // A radio's state is `checked` (native) / `aria-checked` (web; react-native-web drops
              // `accessibilityState`), not `selected`.
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={optionLabel(option)}
              testID={testID ? `${testID}-${option}` : undefined}
            >
              <View
                className={
                  selected
                    ? "min-h-touch justify-center rounded-full border border-highlight/70 bg-highlight/30 px-3 py-1.5"
                    : "min-h-touch justify-center rounded-full border border-primary/16 px-3 py-1.5"
                }
              >
                <Text variant="bodySmall" tone={selected ? "primary" : "muted"}>
                  {optionLabel(option)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Row>
    </Stack>
  );
}
