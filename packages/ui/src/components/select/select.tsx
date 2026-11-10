import { useId, useState, type ComponentRef, type Ref } from "react";
import { Pressable, View } from "react-native";

import { uiCopy } from "../../copy";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../icon";
import { Input } from "../input";
import { FieldLabel, FieldMessage, requiredLabel } from "../input/input.parts";
import { fieldStyles, type FieldState, type InputSize } from "../input/input.styles";
import { Sheet } from "../sheet";
import { Text } from "../text";

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A second line under the label (a hint, a code), optional. */
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export interface SelectProps<T extends string> {
  readonly label: string;
  /** The chosen value, or null for none (the placeholder shows). */
  readonly value: T | null;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly placeholder?: string | undefined;
  readonly helpText?: string | undefined;
  /** Shown instead of the help text in gold; marks the field invalid and is announced. */
  readonly errorText?: string | undefined;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly size?: InputSize | undefined;
  /** Show a search box above the options (for long lists). */
  readonly searchable?: boolean | undefined;
  readonly searchLabel?: string | undefined;
  readonly searchPlaceholder?: string | undefined;
  readonly emptyLabel?: string | undefined;
  readonly noMatchesLabel?: string | undefined;
  /** The option sheet's title; the field label by default. */
  readonly sheetTitle?: string | undefined;
  readonly leadingIcon?: IconName | undefined;
  readonly testID?: string | undefined;
  /** Classes for the whole field block (label, trigger, message). */
  readonly className?: string | undefined;
  /** A ref to the focusable trigger — for focus-on-error and the like, matching Input. */
  readonly ref?: Ref<ComponentRef<typeof Pressable>> | undefined;
}

function triggerState(disabled: boolean, hasError: boolean): FieldState {
  if (disabled) return "disabled";
  if (hasError) return "error";
  return "default";
}

interface SelectTriggerProps {
  readonly label: string;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly hasError: boolean;
  readonly size: InputSize;
  readonly open: boolean;
  readonly text: string;
  readonly hasValue: boolean;
  readonly leadingIcon: IconName | undefined;
  readonly messageId: string;
  readonly hasMessage: boolean;
  readonly testID: string | undefined;
  readonly onPress: () => void;
  readonly triggerRef: Ref<ComponentRef<typeof Pressable>> | undefined;
}

/** The field trigger: the chosen option or the placeholder, with a chevron; shares the Input frame. */
function SelectTrigger(props: SelectTriggerProps) {
  const { label, required, disabled, hasError, size, open, text, hasValue } = props;
  return (
    <Pressable
      ref={props.triggerRef}
      className={fieldStyles({ state: triggerState(disabled, hasError), size })}
      onPress={disabled ? undefined : props.onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      accessibilityLabel={`${requiredLabel(label, required)}: ${text}`}
      aria-invalid={hasError}
      aria-describedby={props.hasMessage ? props.messageId : undefined}
      testID={props.testID}
    >
      {props.leadingIcon ? <Icon name={props.leadingIcon} tone="muted" /> : null}
      <Text
        variant="body"
        tone={disabled ? "disabled" : hasValue ? "body" : "muted"}
        numberOfLines={1}
        className="flex-1"
      >
        {text}
      </Text>
      <Icon name="chevron-down" tone="muted" />
    </Pressable>
  );
}

const OPTION_ROW = "min-h-touch flex-row items-center gap-3 rounded-2xl border px-4 py-3";

/** One option row in the sheet: a radio, the selected one in peacock with a check. */
function SelectOptionRow<T extends string>({
  option,
  selected,
  onPress,
  testID,
}: {
  readonly option: SelectOption<T>;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string | undefined;
}) {
  const disabled = option.disabled === true;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      // react-native-web drops accessibilityState, so the selected state is also aria-checked.
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      accessibilityLabel={option.label}
      testID={testID}
      className={cn(
        OPTION_ROW,
        selected ? "border-highlight/70 bg-highlight/30" : "border-primary/16",
        disabled && "opacity-45",
      )}
    >
      <View className="flex-1">
        <Text variant="body" tone="body" numberOfLines={1}>
          {option.label}
        </Text>
        {option.description ? (
          <Text variant="bodySmall" tone="muted" numberOfLines={2}>
            {option.description}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check-circle" tone="highlight" /> : null}
    </Pressable>
  );
}

/** The radio group of options, or the empty line when there are none to show. */
function SelectOptions<T extends string>({
  shown,
  value,
  onChoose,
  title,
  empty,
  testID,
}: {
  readonly shown: readonly SelectOption<T>[];
  readonly value: T | null;
  readonly onChoose: (value: T) => void;
  readonly title: string;
  readonly empty: string | null;
  readonly testID: string | undefined;
}) {
  if (empty) {
    return (
      <Text variant="bodySmall" tone="muted" testID={testID ? `${testID}-empty` : undefined}>
        {empty}
      </Text>
    );
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={title} className="gap-2">
      {shown.map((option) => (
        <SelectOptionRow
          key={option.value}
          option={option}
          selected={option.value === value}
          onPress={() => onChoose(option.value)}
          testID={testID ? `${testID}-option-${option.value}` : undefined}
        />
      ))}
    </View>
  );
}

interface SelectSheetProps<T extends string> {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly options: readonly SelectOption<T>[];
  readonly value: T | null;
  readonly onChoose: (value: T) => void;
  readonly searchable: boolean;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly noMatchesLabel: string;
  readonly testID: string | undefined;
}

/** The option list on a sheet: an optional search box, then the options; the search resets on close. */
function SelectSheet<T extends string>(props: SelectSheetProps<T>) {
  const { open, title, options, value, searchable, testID } = props;
  const [query, setQuery] = useState("");
  const close = (): void => {
    setQuery("");
    props.onClose();
  };
  const choose = (next: T): void => {
    setQuery("");
    props.onChoose(next);
  };
  const trimmed = query.trim().toLowerCase();
  const shown = trimmed
    ? options.filter((option) => option.label.toLowerCase().includes(trimmed))
    : options;
  const empty =
    options.length === 0 ? props.emptyLabel : shown.length === 0 ? props.noMatchesLabel : null;
  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      testID={testID ? `${testID}-sheet` : undefined}
    >
      {searchable ? (
        <Input
          label={props.searchLabel}
          leadingIcon="search"
          placeholder={props.searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          testID={testID ? `${testID}-search` : undefined}
        />
      ) : null}
      <SelectOptions
        shown={shown}
        value={value}
        onChoose={choose}
        title={title}
        empty={empty}
        testID={testID}
      />
    </Sheet>
  );
}

/**
 * A single-value select: a labelled field trigger (the chosen option or the placeholder, with a
 * chevron) that opens a sheet of options as a radio group, optionally filtered by a search box. It
 * shares the Input field frame — the focus halo, the gold error stroke, the dashed disabled stroke —
 * and takes its label, help and error exactly like Input, so it drops in beside the other form fields.
 * For a small fixed set shown inline, reach for a segmented control or chips instead. Strings are props.
 *
 *   <Select label="Destination" value={id} options={options} onChange={setId} errorText={error} />
 */
export function Select<T extends string>(props: SelectProps<T>) {
  const {
    label,
    value,
    options,
    onChange,
    required = false,
    disabled = false,
    size = "md",
  } = props;
  const labelId = useId();
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const message = props.errorText ?? props.helpText;
  const hasError = Boolean(props.errorText);
  const selected = options.find((option) => option.value === value) ?? null;
  const triggerText = selected ? selected.label : (props.placeholder ?? uiCopy.select.placeholder);
  return (
    <View className={cn("gap-2", props.className)}>
      <FieldLabel id={labelId} label={label} required={required} disabled={disabled} />
      <SelectTrigger
        label={label}
        required={required}
        disabled={disabled}
        hasError={hasError}
        size={size}
        open={open}
        text={triggerText}
        hasValue={Boolean(selected)}
        leadingIcon={props.leadingIcon}
        messageId={messageId}
        hasMessage={Boolean(message)}
        testID={props.testID}
        onPress={() => setOpen(true)}
        triggerRef={props.ref}
      />
      <FieldMessage
        id={messageId}
        text={message}
        isError={hasError}
        isHidden={isHiddenFromVoiceOver({ className: props.className })}
      />
      <SelectSheet
        open={open}
        onClose={() => setOpen(false)}
        title={props.sheetTitle ?? label}
        options={options}
        value={value}
        onChoose={(next) => {
          onChange(next);
          setOpen(false);
        }}
        searchable={props.searchable ?? false}
        searchLabel={props.searchLabel ?? uiCopy.select.search}
        searchPlaceholder={props.searchPlaceholder ?? uiCopy.select.search}
        emptyLabel={props.emptyLabel ?? uiCopy.select.empty}
        noMatchesLabel={props.noMatchesLabel ?? uiCopy.select.noMatches}
        testID={props.testID}
      />
    </View>
  );
}
