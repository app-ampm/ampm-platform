import {
  checkboxBoxStyles,
  checkboxRowStyles,
  checkboxTextStyles,
  cn,
  textStyles,
} from "@ampm/ui/styles";

import { FieldMessage, fieldAria } from "./field-message";
import { peerFocusRingStyles } from "./peer-focus.styles";
import { useIsReadOnly } from "./read-only";

export interface CheckboxFieldProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (event: { target: { checked: boolean } }) => void;
  /** Shown in gold under the row, ringing the box in gold; marks the checkbox invalid. */
  readonly error?: string | undefined;
  /** Announced as required (aria-required): a tick the form cannot go on without. */
  readonly required?: boolean | undefined;
}

/** The box drawn after the hidden native checkbox, for sight only. */
function CheckboxBox({
  checked,
  isInvalid,
}: {
  readonly checked: boolean;
  readonly isInvalid: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        checkboxBoxStyles({ checked, invalid: isInvalid }),
        peerFocusRingStyles,
        "shrink-0",
      )}
    >
      {checked ? <span className="text-sm font-bold text-highlight-ink">✓</span> : null}
    </span>
  );
}

/**
 * A Peacock Night checkbox (§6) on a native one: the whole row is the 44px target, the 22 box at
 * radius 7 is peacock with a midnight ✓ when ticked and a pearl 34% stroke when not (gold when it has
 * an error), and keyboard focus rings the box in gold. The native checkbox stays for keyboards and
 * screen readers, and carries the error's description.
 *
 *   <CheckboxField id="notice" label="I have read the privacy notice" checked={ticked}
 *     onChange={(event) => setTicked(event.target.checked)} required error={errors.notice} />
 */
export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  error,
  required,
}: CheckboxFieldProps) {
  const isReadOnly = useIsReadOnly();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={cn(checkboxRowStyles(), "relative")}>
        <input
          id={id}
          type="checkbox"
          {...fieldAria(id, { error, required })}
          checked={checked}
          onChange={onChange}
          disabled={isReadOnly || undefined}
          className="peer sr-only"
        />
        <CheckboxBox checked={checked} isInvalid={Boolean(error)} />
        <span className={checkboxTextStyles}>
          <span
            className={textStyles({ variant: "bodySmall", tone: checked ? "primary" : "body" })}
          >
            {label}
          </span>
        </span>
      </label>
      <FieldMessage id={id} error={error} />
    </div>
  );
}
