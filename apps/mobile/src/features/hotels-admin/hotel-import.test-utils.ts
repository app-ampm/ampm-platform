import type { HotelImportResult } from "@ampm/core";

import { failure, ok, TEST_API_BASE, type FetchFn } from "../../test/api";

/*
 * Test helpers for the TW-25 import screen: the results the import route returns and a fetch that
 * records each import request as the server receives it (the address with its dry-run query, the raw
 * body, its content type). `routedFetch` drops the query, so it cannot tell a dry run from an apply.
 * Imported by tests only; synthetic hotels only.
 */

export const IMPORT_JOB_ID = "018f0000-0000-7000-8000-00000000f001";

/** A file of three rows: one update, one rejected, one new hotel. */
export const IMPORT_CSV =
  "destinationSlug,name,city\nudaipur,Synthetic Lake Hotel,Udaipur\n,Rejected Row,\ngoa,Synthetic Beach Resort,";

/** What validating {@link IMPORT_CSV} reports. */
export function dryRunResult(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return {
    importJobId: IMPORT_JOB_ID,
    dryRun: true,
    applied: false,
    totalRows: 3,
    created: 1,
    updated: 1,
    unchanged: 0,
    destinationsCreated: 0,
    mediaRegistered: 0,
    rejected: [{ line: 3, errors: [{ field: "destinationSlug", message: "required" }] }],
    rows: [
      { line: 2, slug: "synthetic-lake-hotel", outcome: "update", changedFields: ["city"] },
      { line: 3, slug: null, outcome: "error", changedFields: [] },
      {
        line: 4,
        slug: "synthetic-beach-resort",
        outcome: "create",
        changedFields: ["destinationSlug", "name"],
      },
    ],
    ...overrides,
  };
}

/** What importing {@link IMPORT_CSV} reports. */
export function appliedResult(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return { ...dryRunResult(), dryRun: false, applied: true, destinationsCreated: 1, ...overrides };
}

/** One import request as the API received it. */
export interface ImportRequest {
  readonly path: string;
  readonly body: string;
  readonly contentType: string | null;
}

/**
 * A fetch that answers the hotels import (a dry run or an apply, by the query) and records each request;
 * every other path is a 404.
 *
 *   const requests: ImportRequest[] = [];
 *   await renderWithApi(<HotelImportScreen />, importFetch(requests));
 */
export function importFetch(
  requests: ImportRequest[],
  results: { readonly dry?: HotelImportResult; readonly applied?: HotelImportResult } = {},
): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "");
    if (!path.startsWith("/hotels-admin/imports/hotels?")) {
      return Promise.resolve(failure("not_found", 404));
    }
    const contentType = new Headers(init?.headers).get("content-type");
    requests.push({ path, body: String(init?.body), contentType });
    const isDryRun = path.endsWith("dryRun=true");
    return Promise.resolve(
      ok(isDryRun ? (results.dry ?? dryRunResult()) : (results.applied ?? appliedResult())),
    );
  };
}
