import { refuse } from "./refusal.js";

/*
 * Object headers a viewer could read (D-187 §2). A viewer reaches an object through the cross-reference
 * table, at whatever offset the table gives, or through its repair scan when the table is broken; there it
 * reads `<number> <number> obj`, skipping whitespace and comments between the three. The PDF check reads
 * the file once from the start, and that reading skips comments, strings and stream data, so an object
 * placed inside one of them would never be examined. Every place a header could be read must therefore be
 * an `obj` keyword the check's own reading passed through; any other is refused as unreadable.
 *
 * The search covers the whole file, the data of compressed streams included, without decoding anything: a
 * stream can claim a filter while its data is plain object text, and the chance that genuinely compressed
 * data spells a header is about one in 10^15 per byte. It is one forward pass with a fixed set of states.
 */

const WHITESPACE = 1;
const END_OF_LINE = 2;
/** A character a number token is made of: a viewer reads `+1`, `1.0` and `007` as numbers. */
const NUMERIC = 4;
const PERCENT = 8;
const DELIMITER = 16;
const LETTER_O = 32;
const LETTER_B = 64;
const LETTER_J = 128;

const CLASSES = new Uint8Array(256);
for (const byte of [0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]) CLASSES[byte] = WHITESPACE;
CLASSES[0x0a] = WHITESPACE | END_OF_LINE;
CLASSES[0x0d] = WHITESPACE | END_OF_LINE;
for (let byte = 0x30; byte <= 0x39; byte += 1) CLASSES[byte] = NUMERIC;
for (const byte of [0x2b, 0x2d, 0x2e]) CLASSES[byte] = NUMERIC;
for (const byte of [0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f]) {
  CLASSES[byte] = DELIMITER;
}
CLASSES[0x25] = DELIMITER | PERCENT;
CLASSES[0x6f] = LETTER_O;
CLASSES[0x62] = LETTER_B;
CLASSES[0x6a] = LETTER_J;

/** A token ends before whitespace, a delimiter or the end of the file. */
const ENDS_TOKEN = WHITESPACE | DELIMITER;

/* The states of the search, any number of them at once: a header can start at every number. */
const IN_NUMBER = 1;
const AFTER_NUMBER = 2;
const IN_NUMBER_COMMENT = 4;
const IN_GENERATION = 8;
const AFTER_GENERATION = 16;
const IN_GENERATION_COMMENT = 32;
const READ_O = 64;
const READ_OB = 128;
const READ_OBJ = 256;

/** The states after one byte of class `byteClass`, from `state`. */
function advance(state: number, byteClass: number): number {
  let next = byteClass & NUMERIC ? IN_NUMBER : 0;
  if (state === 0) return next;
  const space = (byteClass & WHITESPACE) !== 0;
  const percent = (byteClass & PERCENT) !== 0;
  if (state & IN_NUMBER) next |= space ? AFTER_NUMBER : percent ? IN_NUMBER_COMMENT : 0;
  if (state & AFTER_NUMBER) {
    if (space) next |= AFTER_NUMBER;
    else if (percent) next |= IN_NUMBER_COMMENT;
    else if (byteClass & NUMERIC) next |= IN_GENERATION;
  }
  if (state & IN_NUMBER_COMMENT) next |= byteClass & END_OF_LINE ? AFTER_NUMBER : IN_NUMBER_COMMENT;
  if (state & IN_GENERATION) {
    if (byteClass & NUMERIC) next |= IN_GENERATION;
    else next |= space ? AFTER_GENERATION : percent ? IN_GENERATION_COMMENT : 0;
  }
  if (state & AFTER_GENERATION) {
    if (space) next |= AFTER_GENERATION;
    else if (percent) next |= IN_GENERATION_COMMENT;
    else if (byteClass & LETTER_O) next |= READ_O;
  }
  if (state & IN_GENERATION_COMMENT) {
    next |= byteClass & END_OF_LINE ? AFTER_GENERATION : IN_GENERATION_COMMENT;
  }
  if (state & READ_O && byteClass & LETTER_B) next |= READ_OB;
  if (state & READ_OB && byteClass & LETTER_J) next |= READ_OBJ;
  return next;
}

/**
 * Calls `visit` with where `obj` starts in every header a viewer could read in `bytes`, in order.
 *
 * @example
 * forEachObjectHeader(Buffer.from("% 9 0 obj"), (at) => found.push(at)); // found: [6]
 */
export function forEachObjectHeader(bytes: Buffer, visit: (at: number) => void): void {
  let state = 0;
  for (let at = 0; at < bytes.length; at += 1) {
    const byteClass = CLASSES[bytes[at] ?? 0] ?? 0;
    if (state & READ_OBJ && byteClass & ENDS_TOKEN) visit(at - 3);
    state = advance(state, byteClass);
  }
  if (state & READ_OBJ) visit(bytes.length - 3);
}

/**
 * Refuses a PDF in which a viewer could read an object header the check did not read. `examined` holds
 * where each `obj` keyword the check read starts, in order.
 *
 * @example
 * refuseUnexaminedHeaders(bytes, scan.objKeywords); // throws for an object hidden in a comment
 */
export function refuseUnexaminedHeaders(bytes: Buffer, examined: readonly number[]): void {
  let next = 0;
  forEachObjectHeader(bytes, (at) => {
    while ((examined[next] ?? Number.POSITIVE_INFINITY) < at) next += 1;
    if (examined[next] !== at) {
      refuse("pdf_unreadable", `an object header at byte ${at} that the check did not read`);
    }
  });
}
