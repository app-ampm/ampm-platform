import { cn, fieldStyles, fieldTextStyles } from "@ampm/ui/styles";

import { CODE_LENGTH, codeInputHandler } from "./code-field.value";
import { fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";

export interface CodeFieldProps {
  readonly id: string;
  readonly label: string;
  /** The digits entered so far. */
  readonly value: string;
  /** Called with digits only, never more than `length` of them. */
  readonly onChange: (code: string) => void;
  /** How many digits the code has; 6 by default. */
  readonly length?: number | undefined;
  /** Turns the pill gold and shows the message in gold; the digits stay. */
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Announced as required (aria-required). */
  readonly required?: boolean | undefined;
  readonly autoFocus?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
}

type CodeInputProps = Omit<CodeFieldProps, "label" | "className" | "length"> & {
  readonly length: number;
};

/** The real input: the number keypad, code autofill, digits only, large and spaced out. */
function CodeInput({
  id,
  value,
  onChange,
  length,
  error,
  help,
  required,
  ...input
}: CodeInputProps) {
  return (
    <input
      id={id}
      {...fieldAria(id, { error, help, required })}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      spellCheck={false}
      autoFocus={input.autoFocus}
      disabled={input.disabled}
      value={value}
      onChange={codeInputHandler(onChange, length)}
      className={cn(
        fieldTextStyles({ disabled: Boolean(input.disabled) }),
        "min-w-0 text-center font-sans-semibold text-2xl tabular-nums tracking-widest web:font-semibold",
      )}
    />
  );
}

/**
 * The one-time code field (D-189 §8, HF-03): one real input in the field's tall pill, the digits large,
 * tabular and spaced out. One visible input, not a row of boxes, so the number keypad, the phone's
 * code autofill (`one-time-code`), paste, the caret and screen readers all meet a single ordinary field;
 * whatever arrives is cut to its digits, and no `maxlength` cuts a pasted "482 917" short.
 *
 *   <CodeField id="code" label="Your 6-digit code" value={code} onChange={setCode} error={error} />
 */
export function CodeField({ label, className, length = CODE_LENGTH, ...input }: CodeFieldProps) {
  const { id, error, help, disabled } = input;
  return (
    <FieldShell {...{ id, label, error, help, className }}>
      <div
        className={fieldStyles({
          state: disabled ? "disabled" : error ? "error" : "default",
          size: "lg",
        })}
      >
        <CodeInput {...input} length={length} />
      </div>
    </FieldShell>
  );
}
