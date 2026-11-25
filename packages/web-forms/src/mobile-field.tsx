import { TextField, type TextFieldProps } from "./text-field";

/** The country code before every mobile the site asks for: codes and calls go to Indian mobiles only. */
export const MOBILE_PREFIX = "+91";

export type MobileFieldProps = Omit<
  TextFieldProps,
  "prefixText" | "type" | "inputMode" | "autoComplete"
>;

/**
 * An Indian mobile number after a fixed "+91" (peacock-night.md §6, Input's prefix): the phone keypad,
 * and the browser's autofill of the number without its country code. The form's schema reads what is
 * typed (`98765 43210`, `+91 98765 43210`, `098765 43210`) and refuses anything else.
 *
 *   <MobileField id="mobile" label="Mobile number" value={mobile} onChange={…} required error={…} />
 */
export function MobileField(props: MobileFieldProps) {
  return (
    <TextField
      {...props}
      prefixText={MOBILE_PREFIX}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
    />
  );
}
