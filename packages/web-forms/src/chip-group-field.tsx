import { useLayoutEffect, useRef, type FocusEventHandler, type Ref } from "react";

import {
  cn,
  fieldLabelStyles,
  filterChipLabelStyles,
  filterChipStyles,
  focusRingStyles,
} from "@ampm/ui/styles";

import type { ChoiceOption } from "./choice-segments";
import { FieldMessage } from "./field-message";
import { useIsReadOnly } from "./read-only";
import { TextField } from "./text-field";

/** The Other chip, and the words it asks for once chosen. */
export interface ChipGroupOther {
  /** The value Other is kept as among the chosen ("Other"). */
  readonly value: string;
  readonly label: string;
  /** The words' field: its id, label, value and change, as a TextField takes them. */
  readonly textId: string;
  readonly textLabel: string;
  readonly text: string;
  readonly onTextChange: (event: { target: { value: string } }) => void;
  readonly textError?: string | undefined;
  readonly textHelp?: string | undefined;
  readonly maxLength?: number | undefined;
}

export interface ChipGroupFieldProps {
  /** The group's id: its error and help lines are named after it. */
  readonly id: string;
  readonly legend: string;
  /** The listed chips, in the order they show. */
  readonly options: readonly ChoiceOption[];
  /** The chosen values, Other's among them when it is chosen. */
  readonly value: readonly string[];
  /** The chosen values after a press, in the options' order with Other last. */
  readonly onChange: (value: readonly string[]) => void;
  /** An Other chip after the listed ones, with a field for what it means. */
  readonly other?: ChipGroupOther | undefined;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Leaving a chip or Other's words (a form saves then). */
  readonly onBlur?: FocusEventHandler<HTMLElement> | undefined;
  readonly className?: string | undefined;
}

/**
 * The chosen values the list does not have (chosen before the list changed): kept, each a chip of its
 * own after the listed ones, until it is unticked.
 */
function unlisted(props: ChipGroupFieldProps): readonly string[] {
  const listed = new Set([...props.options.map((option) => option.value), props.other?.value]);
  return props.value.filter((value) => !listed.has(value));
}

/** The choice after pressing `pressed`: toggled, in the chips' order with Other last. */
function toggled(props: ChipGroupFieldProps, pressed: string): readonly string[] {
  const chosen = new Set(props.value);
  if (chosen.has(pressed)) chosen.delete(pressed);
  else chosen.add(pressed);
  const order = [
    ...props.options.map((option) => option.value),
    ...unlisted(props),
    props.other?.value,
  ];
  return order.filter((value): value is string => value !== undefined && chosen.has(value));
}

interface ChipProps {
  readonly option: ChoiceOption;
  readonly isChosen: boolean;
  readonly describedBy: string | undefined;
  readonly onPress: () => void;
  readonly onBlur: FocusEventHandler<HTMLElement> | undefined;
  readonly buttonRef: Ref<HTMLButtonElement>;
}

/**
 * One chip: a toggle button that is the 44px target, the 38px pill inside it (the kit's FilterChip
 * nested in its target), with the gold ring when the button has keyboard focus.
 */
function Chip({ option, isChosen, describedBy, onPress, onBlur, buttonRef }: ChipProps) {
  const isReadOnly = useIsReadOnly();
  return (
    <li className="flex">
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={isChosen}
        aria-describedby={describedBy}
        onClick={onPress}
        onBlur={onBlur}
        disabled={isReadOnly || undefined}
        className="group -my-1 flex cursor-pointer py-1 outline-none"
      >
        <span className={filterChipStyles({ selected: isChosen, nested: true })}>
          <span className={filterChipLabelStyles({ selected: isChosen })}>{option.label}</span>
        </span>
      </button>
    </li>
  );
}

/** The chips in their order: the listed ones, then the chosen values the list no longer has, then Other. */
function chipsOf(props: ChipGroupFieldProps, kept: readonly string[]): readonly ChoiceOption[] {
  const { options, other } = props;
  return [
    ...options,
    ...kept.map((chosen) => ({ value: chosen, label: chosen })),
    ...(other ? [{ value: other.value, label: other.label }] : []),
  ];
}

/** Other's words, asked for in a field of their own once Other is chosen. */
function OtherWords({
  other,
  onBlur,
}: {
  readonly other: ChipGroupOther;
  readonly onBlur: FocusEventHandler<HTMLElement> | undefined;
}) {
  return (
    <TextField
      id={other.textId}
      label={other.textLabel}
      value={other.text}
      onChange={other.onTextChange}
      onBlur={onBlur}
      error={other.textError}
      help={other.textHelp}
      maxLength={other.maxLength}
    />
  );
}

/**
 * Where focus goes once a kept chip, unticked, has gone with the next render (review fix F5): the chip
 * that came after it, else the group itself, never <body>. `next` names that chip (null for the group).
 */
function useFocusAfterKept(value: readonly string[]) {
  const group = useRef<HTMLFieldSetElement>(null);
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const next = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const target = next.current;
    if (target === undefined) return;
    next.current = undefined;
    const chip = target === null ? undefined : chips.current.get(target);
    (chip ?? group.current)?.focus();
  }, [value]);
  const refOf = (chosen: string) => (node: HTMLButtonElement | null) => {
    if (node === null) return;
    chips.current.set(chosen, node);
    return () => {
      chips.current.delete(chosen);
    };
  };
  return { group, next, refOf };
}

/**
 * A chip group with Other (plan §5.1; D-190 §5): facilities, cuisines. Each chip is a toggle button
 * (aria-pressed) in a fieldset its legend names, so a keyboard tabs to a chip and presses it with Space
 * or Enter, and a screen reader hears whether it is chosen. Choosing Other asks for its words in a field
 * of their own; the chosen values keep the options' order with Other last, whatever the order of presses.
 * A chosen value the options no longer list (they changed after it was saved) stays chosen as a chip of
 * its own after the listed ones, so pressing another chip never drops it; it goes once it is unticked,
 * focus moving on to the chip after it, or to the group when none is.
 *
 *   <ChipGroupField id="facilities" legend="Facilities" options={options} value={chosen}
 *     onChange={setChosen} other={{ value: "Other", label: "Other", textId: "facilities-other",
 *       textLabel: "Other facilities", text, onTextChange }} />
 */
export function ChipGroupField(props: ChipGroupFieldProps) {
  const { id, legend, value, other, error, help, onBlur, className } = props;
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  const kept = unlisted(props);
  const chips = chipsOf(props, kept);
  const focus = useFocusAfterKept(value);
  const press = (pressed: string, place: number) => {
    // A kept chip goes once unticked: focus moves on to what came after it.
    if (kept.includes(pressed)) focus.next.current = chips[place + 1]?.value ?? null;
    props.onChange(toggled(props, pressed));
  };
  return (
    <fieldset
      ref={focus.group}
      id={id}
      tabIndex={-1}
      className={cn("flex min-w-0 flex-col gap-3 rounded", focusRingStyles, className)}
    >
      <legend className={cn(fieldLabelStyles, "mb-2")}>{legend}</legend>
      <ul className="flex flex-row flex-wrap gap-x-2 gap-y-3">
        {chips.map((option, place) => (
          <Chip
            key={option.value}
            option={option}
            isChosen={value.includes(option.value)}
            describedBy={describedBy}
            onPress={() => press(option.value, place)}
            onBlur={onBlur}
            buttonRef={focus.refOf(option.value)}
          />
        ))}
      </ul>
      <FieldMessage id={id} error={error} help={help} />
      {other && value.includes(other.value) ? <OtherWords other={other} onBlur={onBlur} /> : null}
    </fieldset>
  );
}
