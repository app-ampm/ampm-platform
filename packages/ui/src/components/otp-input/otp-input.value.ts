/** The digits of a code, in order, at most `length` of them. */
export function otpDigits(text: string, length: number): string {
  return text.replace(/\D/g, "").slice(0, length);
}

/**
 * How far two strings agree from the start and from the end, never overlapping within the shorter,
 * so `longer.slice(start, longer.length - end)` is what an edit inserted into `shorter`.
 */
function sharedEnds(shorter: string, longer: string): { start: number; end: number } {
  let start = 0;
  while (start < shorter.length && shorter[start] === longer[start]) start += 1;
  let end = 0;
  while (
    end < shorter.length - start &&
    shorter[shorter.length - 1 - end] === longer[longer.length - 1 - end]
  ) {
    end += 1;
  }
  return { start, end };
}

/** True when `longer` is `shorter` with one run of characters inserted somewhere. */
function isInsertion(shorter: string, longer: string): boolean {
  const { start, end } = sharedEnds(shorter, longer);
  return start + end === shorter.length;
}

/**
 * The code after an edit of the hidden field: digits only, at most `length`. The cells fill from the
 * left whatever the hidden caret's position, so a digit typed anywhere joins the end and a digit
 * deleted anywhere leaves from the end; a whole code arriving at once (a paste, SMS autofill)
 * replaces what was there. Any other edit (a selection replaced) is taken as typed.
 *
 *   nextOtpValue("482", "1482", 6); // "4821": typed in front of the hidden caret, joins the end
 *   nextOtpValue("4821", "821", 6); // "482": deleted at the front, leaves from the end
 *   nextOtpValue("48", "48482913", 6); // "482913": a pasted code replaces the start
 */
export function nextOtpValue(previous: string, text: string, length: number): string {
  const before = otpDigits(previous, length);
  const after = text.replace(/\D/g, "");
  if (after.length > before.length && isInsertion(before, after)) {
    const { start, end } = sharedEnds(before, after);
    const inserted = after.slice(start, after.length - end);
    return inserted.length >= length
      ? inserted.slice(0, length)
      : (before + inserted).slice(0, length);
  }
  if (after.length === before.length - 1 && isInsertion(after, before)) {
    return before.slice(0, -1);
  }
  return after.slice(0, length);
}
