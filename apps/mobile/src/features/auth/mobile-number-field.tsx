import { Input } from "@ampm/ui";

export interface MobileNumberFieldProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  /** Under the field: not ten digits, or the API's refusal ("Too many codes for this number…"). */
  readonly errorText: string | undefined;
  /** The keyboard's return key: send the code. */
  readonly onSubmitEditing: () => void;
}

/**
 * The client card's mobile number, with the +91 the schema assumes for ten digits (`indianPhone`):
 * the dev demo's Sign in / Sign up form and AMPM's own client sign-in both ask with it.
 *
 *   <MobileNumberField value={phone} onChangeText={setPhone} errorText={error} onSubmitEditing={send} />
 */
export function MobileNumberField({
  value,
  onChangeText,
  errorText,
  onSubmitEditing,
}: MobileNumberFieldProps) {
  return (
    <Input
      label="Mobile number"
      prefix="+91"
      value={value}
      onChangeText={onChangeText}
      placeholder="98765 43210"
      keyboardType="phone-pad"
      autoComplete="tel"
      errorText={errorText}
      onSubmitEditing={onSubmitEditing}
    />
  );
}
