import type { HotelImportKind, HotelImportResult, MeResponse } from "@ampm/core";

import { failure, jsonResponse, ok, TEST_API_BASE, type FetchFn } from "../../test/api";
import { staffMeFixture } from "../accounts/accounts.test-utils";

/*
 * Test helpers for the TW-25 import screen: the results the import routes return and a fetch that
 * records each import request as the server receives it (the address, the raw body, its content type).
 * It answers `/me` as the Hotel team by default, since the screen offers only the kinds a staff member
 * may import. Imported by tests only; synthetic hotels, rooms and venues only.
 */

export const IMPORT_JOB_ID = "018f0000-0000-7000-8000-00000000f001";

/** A hotels file of three rows: one update, one rejected, one new hotel. */
export const IMPORT_CSV =
  "destinationSlug,name,city\nudaipur,Synthetic Lake Hotel,Udaipur\n,Rejected Row,\ngoa,Synthetic Beach Resort,";

/** A rooms file of two rows: one update, one new room category. */
export const ROOMS_CSV =
  "hotelSlug,name,unitType,sizeSqft\nsynthetic-lake-hotel,Synthetic Garden Suite,suite,650\nsynthetic-lake-hotel,Synthetic Tent,tent,";

/** What validating {@link IMPORT_CSV} reports. */
export function dryRunResult(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return {
    importJobId: IMPORT_JOB_ID,
    kind: "hotels",
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
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Lake Hotel",
        outcome: "update",
        changedFields: ["city"],
      },
      { line: 3, slug: null, name: "Rejected Row", outcome: "error", changedFields: [] },
      {
        line: 4,
        slug: "synthetic-beach-resort",
        name: "Synthetic Beach Resort",
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

/** What validating {@link ROOMS_CSV} reports. */
export function roomsDryRunResult(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return dryRunResult({
    kind: "rooms",
    totalRows: 2,
    created: 1,
    updated: 1,
    rejected: [],
    rows: [
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Garden Suite",
        outcome: "update",
        changedFields: ["sizeSqft", "sizeSqm"],
      },
      {
        line: 3,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Tent",
        outcome: "create",
        changedFields: ["hotelSlug", "name", "unitType"],
      },
    ],
    ...overrides,
  });
}

/** One import request as the API received it. */
export interface ImportRequest {
  readonly path: string;
  readonly body: string | null;
  readonly contentType: string | null;
}

/** How the fake API answers: a kind's preview, the apply, and `/me`. */
export interface ImportAnswers {
  readonly dry?: Partial<Record<HotelImportKind, HotelImportResult>>;
  /** The apply's answer: a result, or a refusal (`{ code, message, status }`). */
  readonly applied?:
    | HotelImportResult
    | { readonly code: string; readonly message: string; readonly status: number };
  readonly me?: MeResponse;
}

const PREVIEW = /^\/hotels-admin\/imports\/(hotels|rooms|venues)$/;
const APPLY = /^\/hotels-admin\/imports\/(hotels|rooms|venues)\/[^/]+\/apply$/;

function dryResult(answers: ImportAnswers, kind: string): HotelImportResult {
  if (kind === "rooms") return answers.dry?.rooms ?? roomsDryRunResult();
  if (kind === "venues") return answers.dry?.venues ?? dryRunResult({ kind: "venues" });
  return answers.dry?.hotels ?? dryRunResult();
}

/** The apply's answer: the one given, or the kind's preview imported (the same kind as its address). */
function applyAnswer(answers: ImportAnswers, kind: string): Response {
  const applied = answers.applied ?? {
    ...dryResult(answers, kind),
    dryRun: false,
    applied: true,
    destinationsCreated: kind === "hotels" ? 1 : 0,
  };
  if ("code" in applied) {
    return jsonResponse(
      { error: { code: applied.code, message: applied.message } },
      applied.status,
    );
  }
  return ok(applied);
}

/**
 * A fetch that answers `/me` (the Hotel team), a kind's preview and the apply by job id, and records
 * each import request; every other path is a 404.
 *
 *   const requests: ImportRequest[] = [];
 *   await renderWithApi(<HotelImportScreen />, importFetch(requests));
 */
export function importFetch(requests: ImportRequest[], answers: ImportAnswers = {}): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "");
    if (path === "/me") return Promise.resolve(ok(answers.me ?? staffMeFixture(["HT"])));
    const preview = PREVIEW.exec(path);
    const apply = APPLY.exec(path);
    if (!preview && !apply) return Promise.resolve(failure("not_found", 404));
    const contentType = new Headers(init?.headers).get("content-type");
    const body = typeof init?.body === "string" ? init.body : null;
    requests.push({ path, body, contentType });
    return Promise.resolve(
      preview ? ok(dryResult(answers, preview[1] ?? "")) : applyAnswer(answers, apply?.[1] ?? ""),
    );
  };
}
