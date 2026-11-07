import { useState, type ReactNode } from "react";

import {
  Button,
  Card,
  FilterChip,
  Input,
  Row,
  SegmentedControl,
  Stack,
  Text,
  uiCopy,
  useBreakpoint,
  type InputProps,
} from "@ampm/ui";

import { amountError, dateError, type ChoiceOption } from "./consultancy-admin.form";

/**
 * The pieces every staff create form shares, built from the Peacock Night kit: the glass form card with
 * its peacock submit and a secondary cancel, an Input whose gold error waits until the field is left
 * (with rupee and date variants that check themselves), and the two pickers that stand in for a Select
 * (the kit has none — ui.md): chips for a longer list, a segmented control for two or three choices.
 * Both pickers start with nothing chosen, so a required choice is always made on purpose.
 */

export interface FormCardProps {
  readonly title: string;
  readonly description?: string | undefined;
  readonly submitLabel: string;
  /** False keeps the submit disabled: a required field is missing or will not parse. */
  readonly ready: boolean;
  readonly pending: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
  readonly children: ReactNode;
  readonly testID?: string | undefined;
}

/**
 * A create form as a top-level glass card: title, fields, then Cancel and the submit. The submit is the
 * peacock confirm (`highlight`, as "Share version N with client" and the transition rows), never gold:
 * the enquiry screen's one gold action is its next pipeline step, and several forms can be open at once.
 */
export function FormCard({ title, description, children, testID, ...actions }: FormCardProps) {
  return (
    <Card className="md:p-7" testID={testID}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Text variant="subheading">{title}</Text>
          {description ? (
            <Text variant="bodySmall" tone="muted">
              {description}
            </Text>
          ) : null}
        </Stack>
        {children}
        <FormActions {...actions} />
      </Stack>
    </Card>
  );
}

type FormActionsProps = Pick<
  FormCardProps,
  "submitLabel" | "ready" | "pending" | "onSubmit" | "onCancel"
>;

function FormActions({ submitLabel, ready, pending, onSubmit, onCancel }: FormActionsProps) {
  return (
    <Row gap={2} justify="end" wrap>
      <Button variant="secondary" disabled={pending} onPress={onCancel}>
        Cancel
      </Button>
      <Button variant="highlight" loading={pending} disabled={!ready} onPress={onSubmit}>
        {submitLabel}
      </Button>
    </Row>
  );
}

export interface FormInputProps extends Omit<InputProps, "errorText"> {
  /** The gold line naming what is wrong; shown once the field has been left, while it still applies. */
  readonly error?: string | undefined;
}

/** An Input that holds its error back until the field is first left, so typing is never interrupted. */
export function FormInput({ error, onBlur, ...input }: FormInputProps) {
  const [isLeft, setLeft] = useState(false);
  return (
    <Input
      {...input}
      errorText={isLeft ? error : undefined}
      onBlur={(event) => {
        setLeft(true);
        onBlur?.(event);
      }}
    />
  );
}

interface CheckedInputProps extends Omit<FormInputProps, "error" | "value"> {
  readonly value: string;
  /** The field as the error names it: "fee" gives "Enter the fee". */
  readonly field: string;
}

/** Rupees: the ₹ prefix, the number pad, and the amount check naming the field. */
export function AmountInput({ field, required = false, value, ...input }: CheckedInputProps) {
  return (
    <FormInput
      prefix="₹"
      keyboardType="number-pad"
      required={required}
      value={value}
      error={amountError(value, field, required)}
      {...input}
    />
  );
}

/** A date typed as YYYY-MM-DD (the kit has no date picker yet), checked as a real calendar date. */
export function DateInput({ field, required = false, value, ...input }: CheckedInputProps) {
  return (
    <FormInput
      autoCapitalize="none"
      required={required}
      value={value}
      error={dateError(value, field, required)}
      {...input}
    />
  );
}

interface ChoiceProps<T extends string> {
  readonly label: string;
  readonly options: ReadonlyArray<ChoiceOption<T>>;
  readonly selected: T | null;
  readonly onSelect: (value: T) => void;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly testID?: string | undefined;
}

/**
 * The picker's label, styled as the Input's (Manrope 600 13 in pearl 80%). A required choice draws an
 * asterisk for the eye and is named "…, required", so the asterisk is never read as "star".
 */
function ChoiceLabel({ label, required }: { readonly label: string; readonly required: boolean }) {
  const spoken = required ? { accessibilityLabel: `${label}, ${uiCopy.required}` } : {};
  return (
    <Text variant="label" tone="body" {...spoken}>
      {label}
      {required ? <Text aria-hidden>{" *"}</Text> : null}
    </Text>
  );
}

/**
 * One choice from a longer list as wrapping filter chips: the chosen one is solid peacock and carries a
 * check, so it never reads by colour alone (code.md); screen readers hear its selected state.
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  required = false,
  testID,
}: ChoiceProps<T>) {
  return (
    <Stack gap={2} testID={testID}>
      <ChoiceLabel label={label} required={required} />
      <Row gap={2} wrap>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={isSelected}
              icon={isSelected ? "check" : undefined}
              disabled={disabled}
              onPress={() => onSelect(option.value)}
            />
          );
        })}
      </Row>
    </Stack>
  );
}

interface ChoiceSegmentsProps<T extends string> extends ChoiceProps<T> {
  /**
   * How the segments sit on a phone: `fill` shares the width equally (short labels), `scroll` keeps
   * longer labels whole and scrolls if they do not fit. From md up they always share the width.
   */
  readonly onPhone?: "fill" | "scroll" | undefined;
}

/** Two or three choices as a segmented control; until one is picked, no segment is selected. */
export function ChoiceSegments<T extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  required = false,
  onPhone = "fill",
  testID,
}: ChoiceSegmentsProps<T>) {
  const { isPhone } = useBreakpoint();
  const scrollable = isPhone && onPhone === "scroll";
  const choose = (value: string): void => {
    const option = options.find((candidate) => candidate.value === value);
    if (option) onSelect(option.value);
  };
  return (
    <Stack gap={2}>
      <ChoiceLabel label={label} required={required} />
      <SegmentedControl
        accessibilityLabel={label}
        options={options.map((option) => ({ ...option, disabled }))}
        // An empty value matches no segment: nothing reads as chosen until the person picks one.
        value={selected ?? ""}
        onChange={choose}
        fullWidth={!scrollable}
        scrollable={scrollable}
        testID={testID}
      />
    </Stack>
  );
}
