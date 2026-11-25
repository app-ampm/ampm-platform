import { AppError, type HotelInfoRequestSummaryView } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCreateHotelInfoRequest,
  useRecordHotelInfoRequestShare,
  useReissueHotelInfoRequest,
  useRevokeHotelInfoRequest,
  useUpdateHotelInfoRequest,
} from "./use-hotel-info-request-actions";
import { HOTEL_INFO_REQUESTS_QUERY_KEY } from "./use-hotel-info-requests";

/*
 * The writes of hotel information requests (D-188 §3): each route's method, path and body, the answer
 * parsed by its strict core schema, every request read refreshed after a change, the API's refusal passed
 * on with its message, and the link (in the create and reissue answers only) forgotten as soon as the
 * sheet that shows it lets go.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000a1";
const BASE = "http://api.test";
const REQUEST = `${BASE}/hotels-admin/info-requests/${REQUEST_ID}`;
const AT = "2026-11-24T10:00:00.000Z";
const LINK = {
  url: "https://site.synthetic.example/hotel-form#k=hfl_synthetic-link-secret",
  expiresAt: "2026-12-24T10:00:00.000Z",
};

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

interface Seen {
  options: Record<string, unknown> | null;
  mutationFn: ((variables: unknown) => Promise<unknown>) | null;
  onSuccess: (() => void) | null;
  answer: Response;
  readonly calls: Call[];
  readonly invalidated: unknown[];
}

/** What the hook handed to useMutation, every request it made, and the keys it refreshed. */
const seen = vi.hoisted((): Seen => ({
  options: null,
  mutationFn: null,
  onSuccess: null,
  answer: new Response(null),
  calls: [],
  invalidated: [],
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (
    options: Record<string, unknown> & {
      mutationFn: Seen["mutationFn"];
      onSuccess?: Seen["onSuccess"];
    },
  ) => {
    seen.options = options;
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

vi.mock("../provider", async () => {
  const { createApiClient } = await import("../client");
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    seen.calls.push({ url: String(input), method: init?.method ?? "GET", body });
    return Promise.resolve(seen.answer);
  };
  const api = createApiClient({ baseUrl: "http://api.test", fetch });
  return { useApiClient: () => api };
});

const ok = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ data }), { status });

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
    expiresAt: LINK.expiresAt,
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

const mutate = (input: unknown): Promise<unknown> =>
  seen.mutationFn?.(input) ?? Promise.reject(new Error("no mutation"));

beforeEach(() => {
  seen.options = null;
  seen.mutationFn = null;
  seen.onSuccess = null;
  seen.answer = new Response(null);
  seen.calls.length = 0;
  seen.invalidated.length = 0;
});

describe("useCreateHotelInfoRequest", () => {
  it("creates a request and answers the link once, with what became of the email", async () => {
    seen.answer = ok({ request: summary(), link: LINK, email: "mode_off" }, 201);
    useCreateHotelInfoRequest();
    const body = {
      target: "existing",
      hotelId: HOTEL_ID,
      emailIt: true,
      recipientEmail: "a@b.example",
    };
    await expect(mutate(body)).resolves.toEqual({
      request: summary(),
      link: LINK,
      email: "mode_off",
    });
    expect(seen.calls).toEqual([
      { url: `${BASE}/hotels-admin/info-requests`, method: "POST", body },
    ]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([HOTEL_INFO_REQUESTS_QUERY_KEY]);
  });

  it("forgets the answer, link and all, once nothing shows it", () => {
    useCreateHotelInfoRequest();
    expect(seen.options?.["gcTime"]).toBe(0);
  });

  it("passes the API's refusal on with its message: a second live request names its reference", async () => {
    const message = "This hotel already has a live request: HIR-2026-0001";
    seen.answer = new Response(JSON.stringify({ error: { code: "conflict", message } }), {
      status: 409,
    });
    useCreateHotelInfoRequest();
    const refused = await mutate({ target: "existing", hotelId: HOTEL_ID }).catch(
      (e: unknown) => e,
    );
    expect(refused).toBeInstanceOf(AppError);
    expect(refused).toMatchObject({ code: "conflict", message });
  });
});

describe("useReissueHotelInfoRequest", () => {
  it("replaces the link, emailing it when asked, and forgets the answer once unseen", async () => {
    seen.answer = ok({ request: summary({ tokenGeneration: 2 }), link: LINK, email: "queued" });
    useReissueHotelInfoRequest();
    expect(seen.options?.["gcTime"]).toBe(0);
    await expect(mutate({ requestId: REQUEST_ID, body: { emailIt: true } })).resolves.toMatchObject(
      {
        link: LINK,
        email: "queued",
      },
    );
    expect(seen.calls).toEqual([
      { url: `${REQUEST}/reissue`, method: "POST", body: { emailIt: true } },
    ]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([HOTEL_INFO_REQUESTS_QUERY_KEY]);
  });

  it("refuses an answer carrying anything beyond the request, the link and the email", async () => {
    seen.answer = ok({ request: summary(), link: LINK, email: "queued", tokenHash: "x" });
    useReissueHotelInfoRequest();
    await expect(mutate({ requestId: REQUEST_ID, body: {} })).rejects.toThrow(/tokenHash/);
  });
});

describe("the changes to a request", () => {
  it("records a share without the link, and refreshes the reads", async () => {
    seen.answer = ok(summary());
    useRecordHotelInfoRequestShare();
    const body = { channel: "whatsapp", note: "Sent to the sales desk" };
    await expect(mutate({ requestId: REQUEST_ID, body })).resolves.toEqual(summary());
    expect(seen.calls).toEqual([{ url: `${REQUEST}/share-record`, method: "POST", body }]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([HOTEL_INFO_REQUESTS_QUERY_KEY]);
  });

  it("edits the label, note and recipient and extends the link", async () => {
    seen.answer = ok(summary({ displayLabel: "Lake refresh" }));
    useUpdateHotelInfoRequest();
    const body = { displayLabel: "Lake refresh", recipientEmail: null, extendDays: 14 };
    await expect(mutate({ requestId: REQUEST_ID, body })).resolves.toMatchObject({
      displayLabel: "Lake refresh",
    });
    expect(seen.calls).toEqual([{ url: REQUEST, method: "PATCH", body }]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([HOTEL_INFO_REQUESTS_QUERY_KEY]);
  });

  it("revokes with a reason, and passes a refusal on with the API's message", async () => {
    seen.answer = ok(summary({ status: "revoked", revokeReason: "Wrong hotel" }));
    useRevokeHotelInfoRequest();
    const body = { reason: "Wrong hotel" };
    await expect(mutate({ requestId: REQUEST_ID, body })).resolves.toMatchObject({
      status: "revoked",
    });
    expect(seen.calls).toEqual([{ url: `${REQUEST}/revoke`, method: "POST", body }]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([HOTEL_INFO_REQUESTS_QUERY_KEY]);
    const message = "A submitted request cannot be revoked";
    seen.answer = new Response(JSON.stringify({ error: { code: "conflict", message } }), {
      status: 409,
    });
    await expect(mutate({ requestId: REQUEST_ID, body })).rejects.toMatchObject({ message });
  });
});
