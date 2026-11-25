import type { InputHTMLAttributes } from "react";

import {
  cn,
  fieldAffixStyles,
  fieldDividerStyles,
  fieldPrefixTextStyles,
  fieldStyles,
  fieldTextStyles,
} from "@ampm/ui/styles";

import { fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "className" | "prefix" | "required" | "children"
>;

export interface TextFieldProps extends NativeInputProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Announced as required (aria-required); the form validates with its schema, not the browser. */
  readonly required?: boolean | undefined;
  readonly optionalText?: string | undefined;
  /** Fixed text before the value ("+91"), in pearl 60% with a divider after it. */
  readonly prefixText?: string | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

/** The "+91" before a mobile number and the rule after it; the field takes the number either way. */
function FieldPrefix({ text }: { readonly text: string }) {
  return (
    <span aria-hidden className={fieldAffixStyles}>
      <span className={fieldPrefixTextStyles}>{text}</span>
      <span className={fieldDividerStyles} />
    </span>
  );
}

/**
 * A labelled pill input (peacock-night.md §6, Input): midnight 50% with a pearl 20% stroke, a gold
 * stroke and halo while focused, a gold stroke and line when invalid. Other input attributes (type,
 * autoComplete, inputMode, placeholder) pass through to the input.
 *
 *   <TextField id="phone" label="Mobile number" prefixText="+91" type="tel" value={phone} onChange={…} />
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  required,
  optionalText,
  prefixText,
  className,
  ...input
}: TextFieldProps) {
  return (
    <FieldShell {...{ id, label, optionalText, error, help, className }}>
      <div className={fieldStyles({ state: error ? "error" : "default" })}>
        {prefixText ? <FieldPrefix text={prefixText} /> : null}
        <input
          id={id}
          {...fieldAria(id, { error, help, required })}
          value={value}
          onChange={onChange}
          className={cn(fieldTextStyles(), "min-w-0 tabular-nums")}
          {...input}
        />
      </div>
    </FieldShell>
  );
}
