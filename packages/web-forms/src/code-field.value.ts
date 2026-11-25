/** How many digits a one-time code has (the API's `totpCode`, D-189 §2). */
export const CODE_LENGTH = 6;

/**
 * The code in what was typed, pasted or filled in from an SMS: its digits, in order, at most `length`
 * of them, so "482 917" and "Your code is 482917." both read as "482917".
 *
 * @example
 * codeDigits("48 29 17"); // "482917"
 */
export function codeDigits(text: string, length: number = CODE_LENGTH): string {
  return text.replace(/\D/g, "").slice(0, length);
}

/**
 * The code field's change handler: whatever reaches the input, the form receives the code it holds.
 *
 * @example
 * <input onChange={codeInputHandler(setCode)} />
 */
export function codeInputHandler(
  onChange: (code: string) => void,
  length: number = CODE_LENGTH,
): (event: { readonly target: { readonly value: string } }) => void {
  return (event) => onChange(codeDigits(event.target.value, length));
}
