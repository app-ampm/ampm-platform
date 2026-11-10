import type { HotelImportResult, HotelImportRowError } from "@ampm/core";

/*
 * Presentation helpers for the hotel CSV import (staff). The column list for the template hint, a one-line
 * summary of a result (a dry run saves nothing), and a readable line per rejected row. No fetching.
 */

/** The CSV columns in import order; the first two are required, the rest optional (blank = unset). */
export const IMPORT_COLUMNS = [
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
] as const;

export const REQUIRED_COLUMNS = ["destinationSlug", "name"] as const;

/** The header row of the import template, ready to paste at the top of a CSV. */
export const IMPORT_TEMPLATE_HEADER = IMPORT_COLUMNS.join(",");

function rows(count: number): string {
  return count === 1 ? "1 row" : `${count} rows`;
}

/** A one-line summary of an import result: a dry run reports counts but saves nothing. */
export function importSummary(result: HotelImportResult): string {
  const valid = result.totalRows - result.rejected.length;
  if (result.dryRun) {
    return `Checked ${rows(result.totalRows)}: ${valid} valid, ${result.rejected.length} rejected — nothing saved yet.`;
  }
  if (!result.applied) {
    const verb = result.totalRows === 1 ? "was" : "were";
    return `Nothing imported — all ${rows(result.totalRows)} ${verb} rejected.`;
  }
  const parts = [`${result.created} created`, `${result.updated} updated`];
  if (result.destinationsCreated > 0) parts.push(`${result.destinationsCreated} new destinations`);
  if (result.mediaRegistered > 0) parts.push(`${result.mediaRegistered} images`);
  return `Imported ${parts.join(" · ")}.`;
}

/** Whether the result carries rejected rows worth showing. */
export function hasRejections(result: HotelImportResult): boolean {
  return result.rejected.length > 0;
}

/** A headline for the rejected block, e.g. "2 of 50 rows rejected", or null when none were. */
export function rejectedHeadline(result: HotelImportResult): string | null {
  if (result.rejected.length === 0) return null;
  return `${result.rejected.length} of ${rows(result.totalRows)} rejected`;
}

/** One rejected row as a line: "Line 5: destinationSlug — required; website — invalid url". */
export function rejectedRowText(row: HotelImportRowError): string {
  const fields = row.errors.map((error) => `${error.field} — ${error.message}`).join("; ");
  return `Line ${row.line}: ${fields}`;
}
