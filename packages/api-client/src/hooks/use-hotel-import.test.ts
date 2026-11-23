import { hotelImportResult, type HotelImportResult } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hotelImportPath, useHotelImport, type HotelImportInput } from "./use-hotel-import";
import { STAFF_DESTINATIONS_QUERY_KEY, STAFF_HOTELS_QUERY_KEY } from "./use-staff-hotels";

interface Upload {
  readonly path: string;
  readonly body: unknown;
  readonly contentType: string;
  readonly schema: unknown;
}

interface Seen {
  mutationFn: ((input: HotelImportInput) => Promise<unknown>) | null;
  onSuccess: ((result: HotelImportResult) => void) | null;
  readonly uploads: Upload[];
  readonly invalidated: unknown[];
}

/** What the hook handed to useMutation, every upload its mutation made, and the keys it refreshed. */
const seen = vi.hoisted((): Seen => ({
  mutationFn: null,
  onSuccess: null,
  uploads: [],
  invalidated: [],
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: Pick<Seen, "mutationFn" | "onSuccess">) => {
    seen.mutationFn = options.mutationFn;
    seen.onSuccess = options.onSuccess;
    return {};
  },
  useQueryClient: () => ({
    invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
      seen.invalidated.push(queryKey);
      return Promise.resolve();
    },
  }),
}));

vi.mock("../provider", () => ({
  useApiClient: () => ({
    upload: (path: string, options: Omit<Upload, "path">) => {
      seen.uploads.push({ path, ...options });
      return Promise.resolve(null);
    },
  }),
}));

function result(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return hotelImportResult.parse({
    importJobId: "0192f1a0-0000-7000-8000-00000000f001",
    dryRun: true,
    applied: false,
    totalRows: 1,
    created: 0,
    updated: 1,
    unchanged: 0,
    destinationsCreated: 0,
    mediaRegistered: 0,
    rejected: [],
    rows: [{ line: 2, slug: "synthetic-lake-hotel", outcome: "update", changedFields: ["city"] }],
    ...overrides,
  });
}

const CSV = "destinationSlug,name,city\nudaipur,Synthetic Lake Hotel,Udaipur";

describe("hotelImportPath", () => {
  it("names the hotels template and carries the dry run in the query", () => {
    expect(hotelImportPath(true)).toBe("/hotels-admin/imports/hotels?dryRun=true");
    expect(hotelImportPath(false)).toBe("/hotels-admin/imports/hotels?dryRun=false");
  });
});

describe("useHotelImport", () => {
  beforeEach(() => {
    seen.mutationFn = null;
    seen.onSuccess = null;
    seen.uploads.length = 0;
    seen.invalidated.length = 0;
  });

  it("uploads the CSV as raw bytes, never as JSON, and reads the import result", async () => {
    useHotelImport();
    await seen.mutationFn?.({ csv: CSV, dryRun: true });
    expect(seen.uploads).toEqual([
      {
        path: "/hotels-admin/imports/hotels?dryRun=true",
        body: CSV,
        contentType: "application/octet-stream",
        schema: hotelImportResult,
      },
    ]);
  });

  it("applies with dryRun=false", async () => {
    useHotelImport();
    await seen.mutationFn?.({ csv: CSV, dryRun: false });
    expect(seen.uploads.map((upload) => upload.path)).toEqual([
      "/hotels-admin/imports/hotels?dryRun=false",
    ]);
  });

  it("refreshes the catalogue and the destinations once an import has written", () => {
    useHotelImport();
    seen.onSuccess?.(result({ dryRun: false, applied: true }));
    expect(seen.invalidated).toEqual([STAFF_HOTELS_QUERY_KEY, STAFF_DESTINATIONS_QUERY_KEY]);
  });

  it("refreshes nothing after a dry run, which writes nothing", () => {
    useHotelImport();
    seen.onSuccess?.(result());
    expect(seen.invalidated).toEqual([]);
  });

  it("refreshes nothing after a real run that wrote nothing, every row unchanged", () => {
    useHotelImport();
    seen.onSuccess?.(result({ dryRun: false, applied: false, updated: 0, unchanged: 1, rows: [] }));
    expect(seen.invalidated).toEqual([]);
  });
});
