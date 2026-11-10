import { useId, useState, type ComponentRef, type Ref } from "react";
import { Pressable, View } from "react-native";

import { isIsoDate } from "@ampm/core";

import { uiCopy } from "../../copy";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Icon } from "../icon";
import { Input } from "../input";
import { FieldLabel, FieldMessage, requiredLabel } from "../input/input.parts";
import { fieldStyles, type FieldState, type InputSize } from "../input/input.styles";
import { Stack } from "../layout";
import { Sheet } from "../sheet";
import { Text } from "../text";
import {
  DATE_RANGE_PRESET_KEYS,
  matchPreset,
  rangeForPreset,
  rangeLabel,
  type DateRange,
  type DateRangePreset,
} from "./date-range";

const DEFAULT_PRESETS: readonly DateRangePreset[] = DATE_RANGE_PRESET_KEYS.map((key) => ({
  key,
  label: uiCopy.dateRange.presets[key],
}));

export interface DateRangeFieldProps {
  readonly label: string;
  readonly value: DateRange;
  readonly onChange: (value: DateRange) => void;
  /** Injected for deterministic presets/labels; defaults to Date.now() at render. */
  readonly now?: number | undefined;
  readonly presets?: readonly DateRangePreset[] | undefined;
  readonly helpText?: string | undefined;
  readonly errorText?: string | undefined;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly size?: InputSize | undefined;
  readonly sheetTitle?: string | undefined;
  readonly testID?: string | undefined;
  readonly ref?: Ref<ComponentRef<typeof Pressable>> | undefined;
  readonly className?: string | undefined;
}

function triggerState(disabled: boolean, hasError: boolean): FieldState {
  if (disabled) return "disabled";
  if (hasError) return "error";
  return "default";
}

interface RangeTriggerProps {
  readonly label: string;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly hasError: boolean;
  readonly size: InputSize;
  readonly open: boolean;
  readonly text: string;
  /** The spoken form of `text` for the accessible name (the arrow glyph read as " to "). */
  readonly spoken: string;
  readonly messageId: string;
  readonly hasMessage: boolean;
  readonly testID: string | undefined;
  readonly triggerRef: Ref<ComponentRef<typeof Pressable>> | undefined;
  readonly onPress: () => void;
}

/** The field trigger: the current range label, with a chevron; shares the Input field frame. */
function RangeTrigger(props: RangeTriggerProps) {
  const { label, required, disabled, hasError, size, open, text } = props;
  return (
    <Pressable
      ref={props.triggerRef}
      className={fieldStyles({ state: triggerState(disabled, hasError), size })}
      onPress={disabled ? undefined : props.onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      accessibilityLabel={`${requiredLabel(label, required)}: ${props.spoken}`}
      aria-invalid={hasError}
      aria-describedby={props.hasMessage ? props.messageId : undefined}
      testID={props.testID}
    >
      <Text
        variant="body"
        tone={disabled ? "disabled" : "body"}
        numberOfLines={1}
        className="flex-1"
      >
        {text}
      </Text>
      <Icon name="chevron-down" tone="muted" />
    </Pressable>
  );
}

const PRESET_ROW =
  "min-h-touch flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3";

/** One preset as a radio row, the active one in peacock with a check. */
function PresetRow(props: {
  readonly preset: DateRangePreset;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string | undefined;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: props.selected }}
      aria-checked={props.selected}
      accessibilityLabel={props.preset.label}
      testID={props.testID}
      className={cn(
        PRESET_ROW,
        props.selected ? "border-highlight/70 bg-highlight/30" : "border-primary/16",
      )}
    >
      <Text variant="body" tone="body" numberOfLines={1}>
        {props.preset.label}
      </Text>
      {props.selected ? <Icon name="check-circle" tone="highlight" /> : null}
    </Pressable>
  );
}

/** The custom from/to entry; it lives inside the sheet, so it reseeds from `value` on every open. */
function CustomRange(props: {
  readonly value: DateRange;
  readonly onApply: (range: DateRange) => void;
  readonly testID: string | undefined;
}) {
  const [from, setFrom] = useState(props.value.from ?? "");
  const [to, setTo] = useState(props.value.to ?? "");
  const fromValid = from === "" || isIsoDate(from);
  const toValid = to === "" || isIsoDate(to);
  const ordered = from === "" || to === "" || from <= to;
  const canApply = (from !== "" || to !== "") && fromValid && toValid && ordered;
  const id = (suffix: string): string | undefined =>
    props.testID ? `${props.testID}-${suffix}` : undefined;
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        {uiCopy.dateRange.custom}
      </Text>
      <Input
        label={uiCopy.dateRange.from}
        value={from}
        onChangeText={setFrom}
        placeholder={uiCopy.dateRange.datePlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        errorText={fromValid ? undefined : uiCopy.dateRange.invalidDate}
        testID={id("from")}
      />
      <Input
        label={uiCopy.dateRange.to}
        value={to}
        onChangeText={setTo}
        placeholder={uiCopy.dateRange.datePlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        errorText={
          !ordered
            ? uiCopy.dateRange.orderError
            : toValid
              ? undefined
              : uiCopy.dateRange.invalidDate
        }
        testID={id("to")}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={!canApply}
        onPress={() => props.onApply({ from: from || undefined, to: to || undefined })}
        testID={id("apply")}
      >
        {uiCopy.dateRange.apply}
      </Button>
    </Stack>
  );
}

function DateRangeSheet(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly value: DateRange;
  readonly now: number;
  readonly presets: readonly DateRangePreset[];
  readonly onChange: (range: DateRange) => void;
  readonly testID: string | undefined;
}) {
  const choose = (range: DateRange): void => {
    props.onChange(range);
    props.onClose();
  };
  const activeKey = matchPreset(props.value, props.now);
  const id = (suffix: string): string | undefined =>
    props.testID ? `${props.testID}-${suffix}` : undefined;
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} testID={id("sheet")}>
      <View accessibilityRole="radiogroup" accessibilityLabel={props.title} className="gap-2">
        {props.presets.map((preset) => (
          <PresetRow
            key={preset.key}
            preset={preset}
            selected={preset.key === activeKey}
            onPress={() => choose(rangeForPreset(preset.key, props.now))}
            testID={id(`preset-${preset.key}`)}
          />
        ))}
      </View>
      <CustomRange value={props.value} onApply={choose} testID={props.testID} />
    </Sheet>
  );
}

/**
 * A date-range field: a labelled trigger showing the chosen range (a preset's label, or "from → to")
 * that opens a sheet of quick presets (All time, Last 7/30/90 days, This month/year) plus a custom
 * from/to entry. It shares the Input field frame and parts and emits a `{ from, to }` of YYYY-MM-DD
 * bounds; "All time" is the empty range. The preset labels (via `presets`) and the field label, help
 * and error are overridable; the custom-entry labels default from uiCopy, and `now` is injectable for
 * tests. For a single date, use an Input; for a small fixed choice, a Select.
 *
 *   <DateRangeField label="Date range" value={range} onChange={setRange} />
 */
export function DateRangeField(props: DateRangeFieldProps) {
  const { label, value, required = false, disabled = false, size = "md" } = props;
  const now = props.now ?? Date.now();
  const presets = props.presets ?? DEFAULT_PRESETS;
  const labelId = useId();
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const message = props.errorText ?? props.helpText;
  const hasError = Boolean(props.errorText);
  const text = rangeLabel(value, now, presets);
  const spoken = rangeLabel(value, now, presets, "to");
  return (
    <View className={cn("gap-2", props.className)}>
      <FieldLabel id={labelId} label={label} required={required} disabled={disabled} />
      <RangeTrigger
        label={label}
        required={required}
        disabled={disabled}
        hasError={hasError}
        size={size}
        open={open}
        text={text}
        spoken={spoken}
        messageId={messageId}
        hasMessage={Boolean(message)}
        testID={props.testID}
        triggerRef={props.ref}
        onPress={() => setOpen(true)}
      />
      <FieldMessage
        id={messageId}
        text={message}
        isError={hasError}
        isHidden={isHiddenFromVoiceOver({ className: props.className })}
      />
      <DateRangeSheet
        open={open}
        onClose={() => setOpen(false)}
        title={props.sheetTitle ?? label}
        value={value}
        now={now}
        presets={presets}
        onChange={props.onChange}
        testID={props.testID}
      />
    </View>
  );
}
