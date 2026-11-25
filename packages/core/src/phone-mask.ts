/**
 * A mobile in E.164 as it is shown back to its person: "+91 ••••• •3210", enough to recognise it and no
 * more. Client activation shows the number on file this way (D-147), and the hotel form's code page the
 * number a code went to (D-189 §4). Any other number keeps its first three characters and last four.
 *
 * @example
 * maskPhone("+919876543210"); // "+91 ••••• •3210"
 */
export function maskPhone(phone: string): string {
  const indian = /^\+91\d{6}(\d{4})$/.exec(phone);
  if (indian) return `+91 ••••• •${indian[1]}`;
  const tail = phone.slice(-4);
  return `${phone.slice(0, 3)} ${"•".repeat(Math.max(phone.length - 7, 1))}${tail}`;
}
