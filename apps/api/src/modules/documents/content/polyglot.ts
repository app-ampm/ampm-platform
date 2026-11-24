import { refuse } from "./refusal.js";
import type { Family } from "./sniff.js";
import { hasUsableEndRecord } from "./zip-end.js";

/*
 * Polyglots are refused, for documents and media originals alike (D-187 §2): a file that one program
 * reads as a JPEG and another as a ZIP or a PDF could carry anything past the check that read it as the
 * first. The third rule, a ZIP with bytes before its first local header or after its end record, is the
 * ZIP reader's (zip.ts), because only it knows where the entries are.
 */

/** PDF readers take a header anywhere in the first 1,024 bytes (ISO 32000-2 §7.5.2, Annex H). */
const PDF_HEADER_WINDOW = 1024;
const PDF_HEADER = Buffer.from("%PDF-", "latin1");

/** Refuses a file of `family` that another reader would also open: a ZIP behind it, or a PDF inside it. */
export function refusePolyglot(bytes: Buffer, family: Family): void {
  if (family !== "zip" && hasUsableEndRecord(bytes)) {
    refuse("polyglot", `a ${family} file with a ZIP end record in its last 64 KiB`);
  }
  if (family !== "pdf") {
    const head = bytes.subarray(0, PDF_HEADER_WINDOW + PDF_HEADER.length - 1);
    if (head.includes(PDF_HEADER)) {
      refuse("polyglot", `a ${family} file with a PDF header in its first 1,024 bytes`);
    }
  }
}
