import { cn, fieldStyles, fieldTextStyles, textStyles } from "@ampm/ui/styles";

import { fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";
import { useIsReadOnly } from "./read-only";
import { frameStateOf } from "./text-field";

/** One choice of a select: what the form keeps, and what the person reads. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly options: readonly SelectOption[];
  /** The chosen option's value, or "" while none is. */
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  /** The first line while nothing is chosen ("Choose one"); it cannot be chosen back. */
  readonly placeholder?: string | undefined;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Announced as required (aria-required); the form validates with its schema, not the browser. */
  readonly required?: boolean | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

type SelectControlProps = Omit<SelectFieldProps, "label" | "className">;

/** The select itself: its placeholder line first, then the options in the canvas's colours. */
function SelectControl({
  id,
  options,
  value,
  onChange,
  placeholder,
  error,
  help,
  required,
}: SelectControlProps) {
  const isReadOnly = useIsReadOnly();
  return (
    <select
      id={id}
      {...fieldAria(id, { error, help, required })}
      value={value}
      onChange={onChange}
      disabled={isReadOnly || undefined}
      className={cn(
        fieldTextStyles(),
        "min-w-0 cursor-pointer appearance-none",
        value === "" && "text-muted",
      )}
    >
      {placeholder === undefined ? null : (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-surface text-primary">
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A labelled native select in the field's pill (peacock-night.md §6, Input): the platform's own list
 * (the phone's wheel, the keyboard's type-ahead), the browser's arrow replaced by a pearl 58% chevron
 * drawn for sight only. The placeholder reads in pearl 58% until a choice is made.
 *
 *   <SelectField id="designation" label="Designation" placeholder="Choose one"
 *     options={[{ value: "General Manager", label: "General Manager" }, …]} value={value} onChange={…} />
 */
export function SelectField({ label, className, ...control }: SelectFieldProps) {
  const { id, error, help } = control;
  const isReadOnly = useIsReadOnly();
  return (
    <FieldShell {...{ id, label, error, help, className }}>
      <div className={fieldStyles({ state: frameStateOf(error, isReadOnly) })}>
        <SelectControl {...control} />
        <span
          aria-hidden
          className={cn(textStyles({ variant: "body", tone: "muted" }), "pointer-events-none")}
        >
          ▾
        </span>
      </div>
    </FieldShell>
  );
}
