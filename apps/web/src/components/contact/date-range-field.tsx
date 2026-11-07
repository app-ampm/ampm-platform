import { cn, fieldLabelStyles, fieldStyles, fieldTextStyles, textStyles } from "@ampm/ui/styles";

import { FieldMessage, fieldAria } from "./field-message";

/** One end of the range: its own input, spoken name and error. */
export interface DateBound {
  readonly id: string;
  /** What screen readers call this input inside the group ("From"). */
  readonly label: string;
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  readonly error?: string | undefined;
}

export interface DateRangeFieldProps {
  readonly legend: string;
  readonly from: DateBound;
  readonly to: DateBound;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

function DateInput({ bound }: { readonly bound: DateBound }) {
  return (
    <input
      id={bound.id}
      {...fieldAria(bound.id, { error: bound.error })}
      type="date"
      aria-label={bound.label}
      value={bound.value}
      onChange={bound.onChange}
      className={cn(fieldTextStyles(), "min-w-0 tabular-nums")}
    />
  );
}

/**
 * Tentative dates as one pill (W6): the start and the end with an arrow between them, under one
 * legend. A range error (the end before the start) shows once under the pill, tied to its input.
 */
export function DateRangeField({ legend, from, to, className }: DateRangeFieldProps) {
  const failing = to.error ? to : from.error ? from : undefined;
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend className={cn(fieldLabelStyles, "mb-2")}>{legend}</legend>
      <div className={cn(fieldStyles({ state: failing ? "error" : "default" }), "gap-2")}>
        <DateInput bound={from} />
        <span aria-hidden className={textStyles({ variant: "body", tone: "muted" })}>
          →
        </span>
        <DateInput bound={to} />
      </div>
      {failing ? <FieldMessage id={failing.id} error={failing.error} /> : null}
    </fieldset>
  );
}
