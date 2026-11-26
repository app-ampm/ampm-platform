import type { FocusEventHandler } from "react";

import { cn, fieldLabelStyles, filterChipLabelStyles, filterChipStyles } from "@ampm/ui/styles";

import type { ChoiceOption } from "./choice-segments";
import { FieldMessage } from "./field-message";
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

/** The choice after pressing `pressed`: toggled, in the options' order with Other last. */
function toggled(props: ChipGroupFieldProps, pressed: string): readonly string[] {
  const chosen = new Set(props.value);
  if (chosen.has(pressed)) chosen.delete(pressed);
  else chosen.add(pressed);
  const order = [...props.options.map((option) => option.value), props.other?.value];
  return order.filter((value): value is string => value !== undefined && chosen.has(value));
}

interface ChipProps {
  readonly option: ChoiceOption;
  readonly isChosen: boolean;
  readonly describedBy: string | undefined;
  readonly onPress: () => void;
  readonly onBlur: FocusEventHandler<HTMLElement> | undefined;
}

/**
 * One chip: a toggle button that is the 44px target, the 38px pill inside it (the kit's FilterChip
 * nested in its target), with the gold ring when the button has keyboard focus.
 */
function Chip({ option, isChosen, describedBy, onPress, onBlur }: ChipProps) {
  return (
    <li className="flex">
      <button
        type="button"
        aria-pressed={isChosen}
        aria-describedby={describedBy}
        onClick={onPress}
        onBlur={onBlur}
        className="group -my-1 flex cursor-pointer py-1 outline-none"
      >
        <span className={filterChipStyles({ selected: isChosen, nested: true })}>
          <span className={filterChipLabelStyles({ selected: isChosen })}>{option.label}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * A chip group with Other (plan §5.1; D-190 §5): facilities, cuisines. Each chip is a toggle button
 * (aria-pressed) in a fieldset its legend names, so a keyboard tabs to a chip and presses it with Space
 * or Enter, and a screen reader hears whether it is chosen. Choosing Other asks for its words in a field
 * of their own; the chosen values keep the options' order with Other last, whatever the order of presses.
 *
 *   <ChipGroupField id="facilities" legend="Facilities" options={options} value={chosen}
 *     onChange={setChosen} other={{ value: "Other", label: "Other", textId: "facilities-other",
 *       textLabel: "Other facilities", text, onTextChange }} />
 */
export function ChipGroupField(props: ChipGroupFieldProps) {
  const { id, legend, options, value, other, error, help, onBlur, className } = props;
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  const chips = other ? [...options, { value: other.value, label: other.label }] : options;
  return (
    <fieldset id={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <legend className={cn(fieldLabelStyles, "mb-2")}>{legend}</legend>
      <ul className="flex flex-row flex-wrap gap-x-2 gap-y-3">
        {chips.map((option) => (
          <Chip
            key={option.value}
            option={option}
            isChosen={value.includes(option.value)}
            describedBy={describedBy}
            onPress={() => props.onChange(toggled(props, option.value))}
            onBlur={onBlur}
          />
        ))}
      </ul>
      <FieldMessage id={id} error={error} help={help} />
      {other && value.includes(other.value) ? (
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
      ) : null}
    </fieldset>
  );
}
