import {
  checkboxBoxStyles,
  checkboxRowStyles,
  checkboxTextStyles,
  cn,
  textStyles,
} from "@ampm/ui/styles";

import { peerFocusRingStyles } from "./contact.styles";

export interface CheckboxFieldProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (event: { target: { checked: boolean } }) => void;
}

/**
 * A Peacock Night checkbox (§6) on a native one: the whole row is the 44px target, the 22 box at
 * radius 7 is peacock with a midnight ✓ when ticked and a pearl 34% stroke when not, and keyboard
 * focus rings the box in gold. The native checkbox stays for keyboards and screen readers.
 */
export function CheckboxField({ id, label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className={cn(checkboxRowStyles(), "relative")}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(checkboxBoxStyles({ checked }), peerFocusRingStyles, "shrink-0")}
      >
        {checked ? <span className="text-sm font-bold text-highlight-ink">✓</span> : null}
      </span>
      <span className={checkboxTextStyles}>
        <span className={textStyles({ variant: "bodySmall", tone: checked ? "primary" : "body" })}>
          {label}
        </span>
      </span>
    </label>
  );
}
