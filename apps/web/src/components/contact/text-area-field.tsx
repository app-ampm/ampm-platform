import { fieldStyles, fieldTextStyles } from "@ampm/ui/styles";

import { fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";

export interface TextAreaFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly rows?: number | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

/** A labelled multi-line field: the input's frame at radius 22 instead of a pill (§6, Input). */
export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  rows = 4,
  className,
}: TextAreaFieldProps) {
  return (
    <FieldShell {...{ id, label, error, help, className }}>
      <div className={fieldStyles({ state: error ? "error" : "default", multiline: true })}>
        <textarea
          id={id}
          {...fieldAria(id, { error, help })}
          rows={rows}
          value={value}
          onChange={onChange}
          className={fieldTextStyles({ multiline: true })}
        />
      </div>
    </FieldShell>
  );
}
