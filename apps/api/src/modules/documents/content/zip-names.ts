import { refuse } from "./refusal.js";

/*
 * Entry names in a ZIP package (D-187 §2). Office reads a part by its name compared case-insensitively
 * after percent-decoding (ECMA-376 Part 2, §6.2.2.3: part name equivalence), so two entries that differ
 * only in case, percent-encoding or Unicode composition are the same part to Office and a way to show the
 * checks one part and Office another. Names that climb out of the package are refused outright.
 */

const PERCENT_RUN = /(?:%[0-9A-Fa-f]{2})+/g;
const DRIVE_LETTER = /^[A-Za-z]:/;

/** Percent-decodes every valid `%XX` run as UTF-8, leaving anything that is not UTF-8 as it was. */
function percentDecode(name: string): string {
  return name.replace(PERCENT_RUN, (run) => {
    const decoded = Buffer.from(run.replace(/%/g, ""), "hex").toString("utf8");
    return decoded.includes("�") ? run : decoded;
  });
}

/** The name two entries are compared by: percent-decoded, NFC-composed and lower-cased. */
export function opcKey(name: string): string {
  return percentDecode(name).normalize("NFC").toLowerCase();
}

function climbs(name: string): boolean {
  const segments = name.split("/");
  return segments.some((segment, index) => {
    if (segment === "." || segment === "..") return true;
    return segment === "" && index < segments.length - 1;
  });
}

/**
 * Refuses a name that is absolute, uses backslashes or a drive letter, holds a NUL, or has a `.` or `..`
 * segment, in its stored form or once percent-decoded (`%2e%2e/` is `../` to a URI reader). A trailing
 * slash (a folder entry) is allowed; an empty segment anywhere else is not.
 */
export function refuseUnsafeName(name: string): void {
  for (const form of new Set([name, percentDecode(name)])) {
    const unsafe =
      form.length === 0 ||
      form.startsWith("/") ||
      form.includes("\\") ||
      form.includes("\0") ||
      DRIVE_LETTER.test(form) ||
      climbs(form);
    if (unsafe) refuse("archive_unsafe", `an entry named ${JSON.stringify(name)}`);
  }
}

/** Refuses the second of any two names that are one part to Office. */
export function refuseDuplicateNames(names: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    const key = opcKey(name);
    if (seen.has(key)) refuse("archive_unsafe", `two entries named ${JSON.stringify(key)}`);
    seen.add(key);
  }
}
