import type { HotelInfoRequestSummaryView } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HOTEL_FORM_MODE_QUERY_KEY,
  HOTEL_INFO_REQUESTS_QUERY_KEY,
  hotelDuplicateHintsPath,
  hotelInfoRequestHistoryQueryKey,
  hotelInfoRequestQueryKey,
  hotelInfoRequestsPath,
  useHotelDuplicateHints,
  useHotelFormMode,
  useHotelInfoRequest,
  useHotelInfoRequestHistory,
  useHotelInfoRequests,
  useHotelInfoRequestsToReview,
} from "./use-hotel-info-requests";

/*
 * The read hooks of hotel information requests (D-188 §3 and §7): each route's path and key, every answer
 * parsed by its strict core schema, the inbox and a hotel's history by cursor, the count of requests to
 * review, the form's mode read afresh, and the duplicate hints only once something reads as a name or an
 * address.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000a1";
const BASE = "http://api.test";
const AT = "2026-11-24T10:00:00.000Z";

type QueryFn = (context: {
  pageParam?: string | undefined;
  signal?: AbortSignal;
}) => Promise<unknown>;

interface Seen {
  options: Record<string, unknown> | null;
  queryFn: QueryFn | null;
  answers: Response[];
  readonly urls: string[];
}

/** What the hook handed to useQuery or useInfiniteQuery, and every URL its function fetched. */
const seen = vi.hoisted((): Seen => ({ options: null, queryFn: null, answers: [], urls: [] }));

vi.mock("@tanstack/react-query", () => {
  const capture = (options: Record<string, unknown> & { queryFn: QueryFn }) => {
    seen.options = options;
    seen.queryFn = options.queryFn;
    return {};
  };
  return { useQuery: capture, useInfiniteQuery: capture, keepPreviousData: () => undefined };
});

vi.mock("../provider", async () => {
  const { createApiClient } = await import("../client");
  const fetch = (input: RequestInfo | URL): Promise<Response> => {
    seen.urls.push(String(input));
    return Promise.resolve(seen.answers.shift() ?? new Response(null, { status: 500 }));
  };
  const api = createApiClient({ baseUrl: "http://api.test", fetch });
  return { useApiClient: () => api };
});

const ok = (data: unknown): Response => new Response(JSON.stringify({ data }), { status: 200 });

function summary(
  overrides: Partial<HotelInfoRequestSummaryView> = {},
): HotelInfoRequestSummaryView {
  return {
    id: REQUEST_ID,
    reference: "HIR-2026-0001",
    kind: "onboarding",
    target: "existing",
    status: "open",
    isTest: false,
    hotelId: HOTEL_ID,
    hotelName: "Synthetic Lake Hotel",
    proposedName: null,
    proposedDestinationId: null,
    proposedWebAddress: null,
    destinationName: "Synthetic Destination",
    officialWebsite: null,
    switchboardPhone: null,
    switchboardSource: null,
    displayLabel: null,
    staffNote: null,
    expiresAt: "2026-12-24T10:00:00.000Z",
    isExpired: false,
    statusOnlyUntil: null,
    tokenGeneration: 1,
    linkIssuedAt: AT,
    linkEmailedAt: null,
    revokedAt: null,
    revokeReason: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

const run = (pageParam?: string): Promise<unknown> =>
  seen.queryFn?.({ pageParam }) ?? Promise.reject(new Error("no query"));

beforeEach(() => {
  seen.options = null;
  seen.queryFn = null;
  seen.answers = [];
  seen.urls.length = 0;
});

describe("hotelInfoRequestsPath", () => {
  it("is the bare inbox with no filters, tests left to the API's default", () => {
    expect(hotelInfoRequestsPath({})).toBe("/hotels-admin/info-requests");
    expect(hotelInfoRequestsPath({ includeTests: false })).toBe("/hotels-admin/info-requests");
  });

  it("names the status, kind, tests, page size and cursor it is given", () => {
    expect(
      hotelInfoRequestsPath({
        status: "in_review",
        kind: "refresh",
        includeTests: true,
        limit: 20,
        cursor: REQUEST_ID,
      }),
    ).toBe(
      `/hotels-admin/info-requests?cursor=${REQUEST_ID}&limit=20&status=in_review&kind=refresh&includeTests=true`,
    );
  });
});

describe("useHotelInfoRequests", () => {
  it("pages the inbox by cursor under its filters, each page parsed strictly", async () => {
    seen.answers = [ok({ items: [summary()], nextCursor: REQUEST_ID })];
    useHotelInfoRequests({ status: "open" });
    expect(seen.options?.["queryKey"]).toEqual([
      ...HOTEL_INFO_REQUESTS_QUERY_KEY,
      "inbox",
      { status: "open" },
    ]);
    await expect(run()).resolves.toEqual({ items: [summary()], nextCursor: REQUEST_ID });
    seen.answers = [ok({ items: [], nextCursor: null })];
    await run(REQUEST_ID);
    expect(seen.urls).toEqual([
      `${BASE}/hotels-admin/info-requests?status=open`,
      `${BASE}/hotels-admin/info-requests?cursor=${REQUEST_ID}&status=open`,
    ]);
  });

  it("refuses a row carrying the recipient or the link: the inbox is summaries alone", async () => {
    seen.answers = [
      ok({ items: [{ ...summary(), recipientEmail: "x@y.example" }], nextCursor: null }),
    ];
    useHotelInfoRequests();
    await expect(run()).rejects.toThrow(/recipientEmail/);
  });
});

describe("useHotelInfoRequestsToReview", () => {
  it("counts the submitted and in-review requests, tests left out", async () => {
    seen.answers = [
      ok({ items: [summary({ status: "submitted" })], nextCursor: null }),
      ok({ items: [summary({ status: "in_review" }), summary()], nextCursor: null }),
    ];
    useHotelInfoRequestsToReview();
    expect(seen.options?.["queryKey"]).toEqual([...HOTEL_INFO_REQUESTS_QUERY_KEY, "to-review"]);
    await expect(run()).resolves.toEqual({ count: 3, isCapped: false });
    expect(seen.urls).toEqual([
      `${BASE}/hotels-admin/info-requests?limit=100&status=submitted`,
      `${BASE}/hotels-admin/info-requests?limit=100&status=in_review`,
    ]);
  });

  it("says when more wait beyond a page, and asks nothing when it may not read", async () => {
    seen.answers = [
      ok({ items: [summary({ status: "submitted" })], nextCursor: REQUEST_ID }),
      ok({ items: [], nextCursor: null }),
    ];
    useHotelInfoRequestsToReview({ enabled: false });
    expect(seen.options?.["enabled"]).toBe(false);
    await expect(run()).resolves.toEqual({ count: 1, isCapped: true });
  });
});

describe("useHotelInfoRequestHistory", () => {
  it("pages one hotel's requests under the hotel's key", async () => {
    seen.answers = [ok({ items: [summary()], nextCursor: null })];
    useHotelInfoRequestHistory(HOTEL_ID);
    expect(seen.options?.["queryKey"]).toEqual(hotelInfoRequestHistoryQueryKey(HOTEL_ID));
    expect(hotelInfoRequestHistoryQueryKey(HOTEL_ID).slice(0, 2)).toEqual([
      ...HOTEL_INFO_REQUESTS_QUERY_KEY,
    ]);
    await expect(run()).resolves.toMatchObject({ items: [{ id: REQUEST_ID }] });
    expect(seen.urls).toEqual([`${BASE}/hotels-admin/hotels/${HOTEL_ID}/info-requests`]);
  });
});

describe("useHotelInfoRequest", () => {
  it("reads one request in the caller's model: the full view for an updater", async () => {
    const full = {
      ...summary(),
      recipientName: "Synthetic Sales Desk",
      recipientEmail: "sales@synthetic-hotel.example",
      extendableUntil: "2027-02-22T10:00:00.000Z",
      events: [],
    };
    seen.answers = [ok(full)];
    useHotelInfoRequest(REQUEST_ID);
    expect(seen.options?.["queryKey"]).toEqual(hotelInfoRequestQueryKey(REQUEST_ID));
    expect(seen.options?.["enabled"]).toBe(true);
    await expect(run()).resolves.toEqual(full);
    expect(seen.urls).toEqual([`${BASE}/hotels-admin/info-requests/${REQUEST_ID}`]);
  });

  it("reads the summary for a reader, refuses anything else, and waits for an id", async () => {
    seen.answers = [ok(summary()), ok({ ...summary(), tokenHash: "x" })];
    useHotelInfoRequest(REQUEST_ID);
    await expect(run()).resolves.toEqual(summary());
    await expect(run()).rejects.toThrow();
    useHotelInfoRequest(null);
    expect(seen.options?.["enabled"]).toBe(false);
  });
});

describe("useHotelFormMode", () => {
  it("reads the mode alone, afresh each time a sheet asks", async () => {
    seen.answers = [ok({ mode: "test_only" }), ok({ mode: "on", replyTo: null })];
    useHotelFormMode({ enabled: true });
    expect(seen.options?.["queryKey"]).toEqual(HOTEL_FORM_MODE_QUERY_KEY);
    expect(seen.options?.["staleTime"]).toBe(0);
    await expect(run()).resolves.toBe("test_only");
    await expect(run()).rejects.toThrow(/replyTo/);
    expect(seen.urls[0]).toBe(`${BASE}/hotels-admin/hotel-form-mode`);
  });
});

describe("hotelDuplicateHintsPath", () => {
  it("sends what was typed, trimmed and encoded, and leaves a blank out", () => {
    expect(hotelDuplicateHintsPath({ name: " Rosé Fort ", webAddress: "  " })).toBe(
      "/hotels-admin/hotel-duplicate-hints?name=Ros%C3%A9+Fort",
    );
    expect(hotelDuplicateHintsPath({ webAddress: "https://fort.example/?a=1&b" })).toBe(
      "/hotels-admin/hotel-duplicate-hints?webAddress=https%3A%2F%2Ffort.example%2F%3Fa%3D1%26b",
    );
    expect(hotelDuplicateHintsPath({ name: "Fort", destinationId: HOTEL_ID })).toBe(
      `/hotels-admin/hotel-duplicate-hints?name=Fort&destinationId=${HOTEL_ID}`,
    );
  });
});

describe("useHotelDuplicateHints", () => {
  const hint = {
    hotelId: HOTEL_ID,
    name: "Synthetic Fort",
    status: "active",
    destinationName: "Synthetic Destination",
    website: null,
    deletedAt: null,
    reasons: ["name"],
    sharedHost: false,
  };

  it("asks once a name or an address reads as one, under what was typed", async () => {
    seen.answers = [ok({ hints: [hint] })];
    useHotelDuplicateHints({ name: " Synthetic Fort ", webAddress: "" });
    expect(seen.options?.["enabled"]).toBe(true);
    expect(seen.options?.["queryKey"]).toEqual([
      "hotels-admin",
      "hotel-duplicate-hints",
      { name: "Synthetic Fort", webAddress: "", destinationId: "" },
    ]);
    await expect(run()).resolves.toEqual({ hints: [hint], liveRequests: [] });
  });

  it("asks under the destination chosen, and answers its live requests of the same name (D-192)", async () => {
    const live = {
      requestId: REQUEST_ID,
      reference: "HIR-2026-0003",
      status: "open",
      isTest: false,
      proposedName: "Synthetic Fort",
      destinationName: "Synthetic Destination",
      proposedWebAddress: null,
    };
    seen.answers = [ok({ hints: [], liveRequests: [live] })];
    useHotelDuplicateHints({ name: "Synthetic Fort", destinationId: HOTEL_ID });
    expect(seen.options?.["queryKey"]).toEqual([
      "hotels-admin",
      "hotel-duplicate-hints",
      { name: "Synthetic Fort", webAddress: "", destinationId: HOTEL_ID },
    ]);
    await expect(run()).resolves.toEqual({ hints: [], liveRequests: [live] });
    expect(seen.urls[0]).toContain(`destinationId=${HOTEL_ID}`);
  });

  it("asks nothing for a letter or two, nor when the sheet is closed", () => {
    useHotelDuplicateHints({ name: "Sy", webAddress: "ab" });
    expect(seen.options?.["enabled"]).toBe(false);
    useHotelDuplicateHints({ name: "Synthetic" }, { enabled: false });
    expect(seen.options?.["enabled"]).toBe(false);
  });
});
