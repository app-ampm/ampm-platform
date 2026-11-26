import type { FocusEventHandler } from "react";

import {
  cn,
  fieldAffixStyles,
  fieldDividerStyles,
  fieldStyles,
  fieldTextStyles,
  focusRingStyles,
  textStyles,
} from "@ampm/ui/styles";

import { fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";
import { useIsReadOnly } from "./read-only";
import type { SelectOption } from "./select-field";
import { frameStateOf } from "./text-field";

export interface NumberUnitFieldProps {
  /** The number's id: the label points at it; the unit list is `<id>-unit`. */
  readonly id: string;
  readonly label: string;
  /** The number as typed ("1,200"); the form reads it, so a half-typed number stays as typed. */
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  /** The chosen unit's value ("sqft"). */
  readonly unit: string;
  /** The units offered ("sq ft", "m²"). */
  readonly units: readonly SelectOption[];
  readonly onUnitChange: (event: { target: { value: string } }) => void;
  /** The unit list's own name for screen readers ("Unit of the size"). */
  readonly unitLabel: string;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Announced as required (aria-required); the form validates with its schema, not the browser. */
  readonly required?: boolean | undefined;
  readonly optionalText?: string | undefined;
  /** The phone keypad: numeric for whole numbers (default), decimal where a point is allowed. */
  readonly inputMode?: "numeric" | "decimal" | undefined;
  /** Leaving the number or its unit (a form saves then). */
  readonly onBlur?: FocusEventHandler<HTMLElement> | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

/**
 * The unit list's id, from the number's.
 *
 * @example
 * unitSelectId("room-size"); // "room-size-unit"
 */
export function unitSelectId(id: string): string {
  return `${id}-unit`;
}

type UnitListProps = Pick<
  NumberUnitFieldProps,
  "id" | "unit" | "units" | "onUnitChange" | "unitLabel" | "onBlur"
> & { readonly describedBy: string | undefined };

/** The list's look: the field's text in a target at least 44px wide, room for the chevron, its own ring. */
const UNIT_LIST_STYLES = cn(
  fieldTextStyles(),
  "min-w-touch cursor-pointer appearance-none rounded-full border border-transparent pl-3 pr-8",
  focusRingStyles,
);

/** The chevron, for sight only, over the list's own box: part of its target, presses pass through. */
function UnitChevron() {
  return (
    <span
      aria-hidden
      className={cn(
        textStyles({ variant: "body", tone: "muted" }),
        "pointer-events-none absolute inset-y-0 right-3 flex items-center",
      )}
    >
      ▾
    </span>
  );
}

/**
 * The unit list itself: a native select with a name of its own, at least 44px wide and the field's height,
 * ringed in gold on its own when it has keyboard focus (the field's ring says the field has it), and the
 * chevron drawn inside its box, so pressing the chevron opens the list too.
 */
function UnitList({
  id,
  unit,
  units,
  onUnitChange,
  unitLabel,
  describedBy,
  onBlur,
}: UnitListProps) {
  const isReadOnly = useIsReadOnly();
  return (
    <span className="relative flex shrink-0 self-stretch">
      <select
        id={unitSelectId(id)}
        aria-label={unitLabel}
        aria-describedby={describedBy}
        value={unit}
        onChange={onUnitChange}
        onBlur={onBlur}
        disabled={isReadOnly || undefined}
        className={UNIT_LIST_STYLES}
      >
        {units.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface text-primary">
            {option.label}
          </option>
        ))}
      </select>
      <UnitChevron />
    </span>
  );
}

/** The unit list after the number, past a pearl rule. */
function UnitSelect(props: UnitListProps) {
  return (
    <>
      <span aria-hidden className={fieldAffixStyles}>
        <span className={fieldDividerStyles} />
      </span>
      <UnitList {...props} />
    </>
  );
}

/**
 * A number with its unit in one field pill (peacock-night.md §6, Input): the number as typed, then a rule
 * and a native list of units, so an area is given in sq ft or m² as the hotel's fact sheet gives it. Both
 * controls carry the field's error or help, and the list has a name of its own.
 *
 *   <NumberUnitField id="size" label="Size" value={size} onChange={…} unit={unit}
 *     units={[{ value: "sqft", label: "sq ft" }, { value: "sqm", label: "m²" }]}
 *     onUnitChange={…} unitLabel="Unit of the size" error={errors.size} />
 */
export function NumberUnitField(props: NumberUnitFieldProps) {
  const { id, label, value, onChange, error, help, required, optionalText, className } = props;
  const aria = fieldAria(id, { error, help, required });
  const isReadOnly = useIsReadOnly();
  return (
    <FieldShell {...{ id, label, optionalText, error, help, className }}>
      <div className={fieldStyles({ state: frameStateOf(error, isReadOnly) })}>
        <input
          id={id}
          {...aria}
          type="text"
          inputMode={props.inputMode ?? "numeric"}
          autoComplete="off"
          value={value}
          onChange={onChange}
          onBlur={props.onBlur}
          readOnly={isReadOnly || undefined}
          className={cn(fieldTextStyles(), "min-w-0 tabular-nums")}
        />
        <UnitSelect {...props} describedBy={aria["aria-describedby"]} />
      </div>
    </FieldShell>
  );
}
