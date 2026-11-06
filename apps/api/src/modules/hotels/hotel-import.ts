/*
 * Pure helpers for the hotel spreadsheet import (TW-25; AC-35.1). No Nest, no Prisma — so they test in
 * isolation. `parseCsv` is a small RFC-4180 state machine (quoted fields, escaped `""`, embedded commas
 * and newlines, CRLF). `buildCandidate` turns one raw row into a typed object ready for `hotelImportRow`:
 * blanks become undefined (so optional fields drop out), numeric/boolean columns coerce, a non-coercible
 * value falls through as its string so the schema reports a clear field error, and unknown spreadsheet
 * columns are ignored rather than failing the row.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A row is blank (a spreadsheet's trailing empty line) when every cell is empty after trimming. */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

const NUMERIC_COLUMNS = new Set(["latitude", "longitude", "totalRooms", "internalRating"]);
const BOOLEAN_COLUMNS = new Set(["demoVisible"]);
const KNOWN_COLUMNS = new Set([
  "destinationSlug",
  "destinationName",
  "slug",
  "name",
  "brand",
  "starCategory",
  "address",
  "latitude",
  "longitude",
  "descriptionClient",
  "website",
  "totalRooms",
  "demoVisible",
  "status",
  "internalRating",
  "internalNotes",
  "streetViewRef",
  "imageRef",
]);

/** The header labels of the frozen import template, in order — used to write the template and its docs. */
export const HOTEL_IMPORT_COLUMNS: readonly string[] = [
  "destinationSlug",
  "destinationName",
  "slug",
  "name",
  "brand",
  "starCategory",
  "address",
  "latitude",
  "longitude",
  "descriptionClient",
  "website",
  "totalRooms",
  "demoVisible",
  "status",
  "internalRating",
  "internalNotes",
  "streetViewRef",
  "imageRef",
];

function coerceBoolean(raw: string): boolean | string {
  const s = raw.toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return raw; // a non-boolean value falls through so z.boolean() reports it
}

export function buildCandidate(
  headers: readonly string[],
  cells: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    const key = header.trim();
    if (!KNOWN_COLUMNS.has(key)) return; // ignore extra spreadsheet columns
    const raw = (cells[index] ?? "").trim();
    if (raw === "") return; // a blank cell is "unset", not an empty string
    if (NUMERIC_COLUMNS.has(key)) {
      const num = Number(raw);
      out[key] = Number.isNaN(num) ? raw : num;
    } else if (BOOLEAN_COLUMNS.has(key)) {
      out[key] = coerceBoolean(raw);
    } else {
      out[key] = raw;
    }
  });
  return out;
}

/** Lowercase a name into a slug (`The Lake Pavilion` → `the-lake-pavilion`); matches the `slug` contract. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Title-case a slug into a display name when an import creates a destination without one (`goa` → `Goa`). */
export function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
