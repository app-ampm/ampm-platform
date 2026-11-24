import { hotelImportResult, type HotelImportResult } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOTEL_MEDIA_QUERY_KEY } from "./use-hotel-media";
import {
  hotelImportApplyPath,
  hotelImportPreviewPath,
  useHotelImportApply,
  useHotelImportPreview,
  type HotelImportApplyInput,
  type HotelImportPreviewInput,
} from "./use-hotel-import";
import {
  STAFF_DESTINATIONS_QUERY_KEY,
  STAFF_HOTELS_QUERY_KEY,
  staffHotelQueryKey,
} from "./use-staff-hotels";

interface Sent {
  readonly via: "upload" | "request";
  readonly path: string;
  readonly options: Readonly<Record<string, unknown>>;
}

interface Seen {
  mutationFn: ((input: HotelImportPreviewInput & HotelImportApplyInput) => Promise<unknown>) | null;
  onSuccess: ((result: HotelImportResult) => void) | null;
  readonly sent: Sent[];
  readonly invalidated: unknown[];
}

/** What the hook handed to useMutation, every call its mutation made, and the keys it refreshed. */
const seen = vi.hoisted((): Seen => ({
  mutationFn: null,
  onSuccess: null,
  sent: [],
  invalidated: [],
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: Seen["mutationFn"]; onSuccess?: Seen["onSuccess"] }) => {
    seen.mutationFn = options.mutationFn;
    seen.onSuccess = options.onSuccess ?? null;
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
    upload: (path: string, options: Record<string, unknown>) => {
      seen.sent.push({ via: "upload", path, options });
      return Promise.resolve(null);
    },
    request: (path: string, options: Record<string, unknown>) => {
      seen.sent.push({ via: "request", path, options });
      return Promise.resolve(null);
    },
  }),
}));

const JOB_ID = "0192f1a0-0000-7000-8000-00000000f001";

function result(overrides: Partial<HotelImportResult> = {}): HotelImportResult {
  return hotelImportResult.parse({
    importJobId: JOB_ID,
    kind: "rooms",
    dryRun: true,
    applied: false,
    totalRows: 1,
    created: 0,
    updated: 1,
    unchanged: 0,
    destinationsCreated: 0,
    mediaRegistered: 0,
    rejected: [],
    rows: [
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Garden Suite",
        outcome: "update",
        changedFields: ["sizeSqft", "sizeSqm"],
      },
    ],
    ...overrides,
  });
}

const CSV = "hotelSlug,name,sizeSqft\nsynthetic-lake-hotel,Synthetic Garden Suite,650";

beforeEach(() => {
  seen.mutationFn = null;
  seen.onSuccess = null;
  seen.sent.length = 0;
  seen.invalidated.length = 0;
});

describe("the import addresses", () => {
  // The previous API image imports a bare upload, so a Validate sent to it during a rollback must still
  // say it is a dry run; this API takes `dryRun=true` for that one release (core `hotelImportQuery`).
  it("previews each kind at its own address, always as a dry run", () => {
    expect(hotelImportPreviewPath("hotels")).toBe("/hotels-admin/imports/hotels?dryRun=true");
    expect(hotelImportPreviewPath("rooms")).toBe("/hotels-admin/imports/rooms?dryRun=true");
    expect(hotelImportPreviewPath("venues")).toBe("/hotels-admin/imports/venues?dryRun=true");
  });

  it("imports a preview of a kind by its job id", () => {
    expect(hotelImportApplyPath("venues", JOB_ID)).toBe(
      `/hotels-admin/imports/venues/${JOB_ID}/apply`,
    );
    expect(hotelImportApplyPath("hotels", "a/b")).toBe("/hotels-admin/imports/hotels/a%2Fb/apply");
  });
});

describe("useHotelImportPreview", () => {
  it.each(["hotels", "rooms", "venues"] as const)(
    "uploads a %s CSV as raw bytes, never as JSON, and reads the import result",
    async (kind) => {
      useHotelImportPreview();
      await seen.mutationFn?.({ kind, csv: CSV, jobId: "" });
      expect(seen.sent).toEqual([
        {
          via: "upload",
          path: `/hotels-admin/imports/${kind}?dryRun=true`,
          options: {
            body: CSV,
            contentType: "application/octet-stream",
            schema: hotelImportResult,
          },
        },
      ]);
    },
  );

  it("refreshes nothing: a preview writes nothing but its job", () => {
    useHotelImportPreview();
    expect(seen.onSuccess).toBeNull();
  });
});

describe("useHotelImportApply", () => {
  it("posts an empty JSON body to the preview's apply address and reads the import result", async () => {
    useHotelImportApply();
    await seen.mutationFn?.({ kind: "rooms", jobId: JOB_ID, csv: "" });
    expect(seen.sent).toEqual([
      {
        via: "request",
        path: `/hotels-admin/imports/rooms/${JOB_ID}/apply`,
        options: { method: "POST", body: {}, schema: hotelImportResult },
      },
    ]);
  });

  it("refreshes the catalogue, every hotel detail and the destinations once an import has written", () => {
    useHotelImportApply();
    seen.onSuccess?.(result({ dryRun: false, applied: true }));
    expect(seen.invalidated).toEqual([STAFF_HOTELS_QUERY_KEY, STAFF_DESTINATIONS_QUERY_KEY]);
    // A detail's key starts with the catalogue's, so the one refresh reloads the rooms and venues in it.
    expect(staffHotelQueryKey("hotel-1").slice(0, STAFF_HOTELS_QUERY_KEY.length)).toEqual([
      ...STAFF_HOTELS_QUERY_KEY,
    ]);
  });

  it("refreshes every hotel's media too once a hotels import has registered images", () => {
    useHotelImportApply();
    seen.onSuccess?.(result({ kind: "hotels", dryRun: false, applied: true, mediaRegistered: 2 }));
    expect(seen.invalidated).toEqual([
      STAFF_HOTELS_QUERY_KEY,
      STAFF_DESTINATIONS_QUERY_KEY,
      HOTEL_MEDIA_QUERY_KEY,
    ]);
  });

  it("refreshes nothing after an import that wrote nothing, every row unchanged or refused", () => {
    useHotelImportApply();
    seen.onSuccess?.(result({ dryRun: false, applied: false, updated: 0, unchanged: 1, rows: [] }));
    expect(seen.invalidated).toEqual([]);
  });
});
