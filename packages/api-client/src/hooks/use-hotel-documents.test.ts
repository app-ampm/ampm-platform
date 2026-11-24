import { AppError, type HotelDocumentView } from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hotelDocumentsQueryKey,
  hotelDocumentUploadPath,
  useDeleteHotelDocument,
  useHotelDocumentLink,
  useHotelDocuments,
  useUploadHotelDocument,
  type HotelDocumentUploadInput,
} from "./use-hotel-documents";
import { staffHotelQueryKey } from "./use-staff-hotels";

const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000c0001";
const DOCUMENT_ID = "0192f1a0-0000-7000-8000-0000000d0003";
const EARLIER_ID = "0192f1a0-0000-7000-8000-0000000d0002";
const BASE = "http://api.test";
const DOCUMENTS = `/hotels-admin/hotels/${HOTEL_ID}/documents`;

interface Call {
  readonly url: string;
  readonly method: string;
  readonly contentType: string | undefined;
  readonly body: unknown;
}

interface Seen {
  queryKey: unknown;
  queryFn: ((context: { signal?: AbortSignal }) => Promise<unknown>) | null;
  mutationFn: ((variables: unknown) => Promise<unknown>) | null;
  onSuccess: (() => void) | null;
  onError: ((error: Error) => void) | null;
  answer: Response;
  readonly calls: Call[];
  readonly invalidated: unknown[];
}

/**
 * What a hook handed to useQuery or useMutation, every request its function made through the real API
 * client (a fake fetch answers with `answer`), and the keys it refreshed.
 */
const seen = vi.hoisted((): Seen => ({
  queryKey: null,
  queryFn: null,
  mutationFn: null,
  onSuccess: null,
  onError: null,
  answer: new Response(null),
  calls: [],
  invalidated: [],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: Pick<Seen, "queryKey" | "queryFn">) => {
    seen.queryKey = options.queryKey;
    seen.queryFn = options.queryFn;
    return {};
  },
  useMutation: (options: {
    mutationFn: Seen["mutationFn"];
    onSuccess?: Seen["onSuccess"];
    onError?: Seen["onError"];
  }) => {
    seen.mutationFn = options.mutationFn;
    seen.onSuccess = options.onSuccess ?? null;
    seen.onError = options.onError ?? null;
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
    seen.calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      contentType: new Headers(init?.headers).get("content-type") ?? undefined,
      body: init?.body,
    });
    return Promise.resolve(seen.answer);
  };
  // The factory runs before this module's constants exist (vi.mock is hoisted): the base is written out.
  const api = createApiClient({ baseUrl: "http://api.test", fetch });
  return { useApiClient: () => api };
});

const ok = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ data }), { status });
const failure = (code: string, status: number): Response =>
  new Response(JSON.stringify({ error: { code, message: code } }), { status });

function documentView(overrides: Partial<HotelDocumentView> = {}): HotelDocumentView {
  const version = {
    id: EARLIER_ID,
    documentType: "menu" as const,
    title: "Banquet menu",
    mimeType: "application/pdf",
    sizeBytes: 1_024,
    versionNumber: 1,
    createdAt: "2026-11-01T09:00:00.000Z",
  };
  return {
    ...version,
    id: DOCUMENT_ID,
    versionNumber: 2,
    hotelId: HOTEL_ID,
    versions: [version],
    ...overrides,
  };
}

/** Runs the mutation the last hook handed over, as React Query would. */
const mutate = (input: unknown): Promise<unknown> =>
  seen.mutationFn?.(input) ?? Promise.reject(new Error("no mutation"));

beforeEach(() => {
  seen.queryKey = null;
  seen.queryFn = null;
  seen.mutationFn = null;
  seen.onSuccess = null;
  seen.onError = null;
  seen.answer = new Response(null);
  seen.calls.length = 0;
  seen.invalidated.length = 0;
});

describe("hotelDocumentUploadPath", () => {
  it("names the type of a new document, and nothing else when it has no title", () => {
    expect(hotelDocumentUploadPath(HOTEL_ID, { type: "fact_sheet" })).toBe(
      `${DOCUMENTS}?type=fact_sheet`,
    );
    // A blank title is left out, so the API names the document after its type, or keeps the title of
    // the document a replacement follows.
    expect(hotelDocumentUploadPath(HOTEL_ID, { type: "menu", title: "   " })).toBe(
      `${DOCUMENTS}?type=menu`,
    );
  });

  it("sends a trimmed, encoded title and the document a replacement follows", () => {
    expect(
      hotelDocumentUploadPath(HOTEL_ID, {
        type: "beverage_menu",
        title: " Bar & lounge menu ",
        replaces: DOCUMENT_ID,
      }),
    ).toBe(`${DOCUMENTS}?type=beverage_menu&title=Bar+%26+lounge+menu&replaces=${DOCUMENT_ID}`);
  });
});

describe("useHotelDocuments", () => {
  it("lists a hotel's documents under the hotel's key", async () => {
    seen.answer = ok({ items: [documentView()] });
    useHotelDocuments(HOTEL_ID);
    expect(seen.queryKey).toEqual(hotelDocumentsQueryKey(HOTEL_ID));
    expect(hotelDocumentsQueryKey(HOTEL_ID).slice(0, 3)).toEqual([...staffHotelQueryKey(HOTEL_ID)]);
    await expect(seen.queryFn?.({})).resolves.toEqual([documentView()]);
    expect(seen.calls).toEqual([
      { url: `${BASE}${DOCUMENTS}`, method: "GET", contentType: undefined, body: undefined },
    ]);
  });

  it("refuses a document carrying a field the contract does not name", async () => {
    seen.answer = ok({ items: [{ ...documentView(), storageKey: "hotels/secret.pdf" }] });
    useHotelDocuments(HOTEL_ID);
    await expect(seen.queryFn?.({})).rejects.toThrow(/storageKey/);
  });
});

describe("useUploadHotelDocument", () => {
  it("uploads the file as raw bytes with its type, title and the document it replaces", async () => {
    const file = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    seen.answer = ok(documentView({ versionNumber: 3 }), 201);
    useUploadHotelDocument(HOTEL_ID);
    const input: HotelDocumentUploadInput = {
      type: "menu",
      title: "Banquet menu",
      replaces: DOCUMENT_ID,
      file,
    };
    await expect(mutate(input)).resolves.toMatchObject({ versionNumber: 3 });
    expect(seen.calls).toEqual([
      {
        url: `${BASE}${DOCUMENTS}?type=menu&title=Banquet+menu&replaces=${DOCUMENT_ID}`,
        method: "POST",
        contentType: "application/octet-stream",
        body: file,
      },
    ]);
  });

  it("refreshes the hotel's documents once the upload is filed", () => {
    useUploadHotelDocument(HOTEL_ID);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([hotelDocumentsQueryKey(HOTEL_ID)]);
  });

  it("passes the API's refusal on, with its message on the file", async () => {
    const message = "Word files are not accepted: save it as a PDF and upload that.";
    seen.answer = new Response(
      JSON.stringify({
        error: { code: "unsupported_media_type", message, details: [{ path: "file", message }] },
      }),
      { status: 415 },
    );
    useUploadHotelDocument(HOTEL_ID);
    const refused = await mutate({ type: "menu", file: new Blob(["PK"]) }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(AppError);
    expect(refused).toMatchObject({
      code: "unsupported_media_type",
      details: [{ path: "file", message }],
    });
  });
});

describe("useDeleteHotelDocument", () => {
  it("deletes a document by its latest version and refreshes the list", async () => {
    seen.answer = ok({ id: DOCUMENT_ID });
    useDeleteHotelDocument(HOTEL_ID);
    await expect(mutate(DOCUMENT_ID)).resolves.toEqual({ id: DOCUMENT_ID });
    expect(seen.calls).toEqual([
      {
        url: `${BASE}${DOCUMENTS}/${DOCUMENT_ID}`,
        method: "DELETE",
        contentType: undefined,
        body: undefined,
      },
    ]);
    seen.onSuccess?.();
    expect(seen.invalidated).toEqual([hotelDocumentsQueryKey(HOTEL_ID)]);
  });
});

describe("useHotelDocumentLink", () => {
  it("mints a 15-minute link to any version, resolved against the API base", async () => {
    const url = "/documents/links/0192f1a0-0000-7000-8000-00000000a111/token";
    seen.answer = ok({ url, expiresAt: "2026-11-24T12:15:00.000Z" }, 201);
    useHotelDocumentLink(HOTEL_ID);
    await expect(mutate(EARLIER_ID)).resolves.toEqual({
      url: `${BASE}${url}`,
      expiresAt: "2026-11-24T12:15:00.000Z",
    });
    expect(seen.calls).toEqual([
      {
        url: `${BASE}${DOCUMENTS}/${EARLIER_ID}/link`,
        method: "POST",
        contentType: undefined,
        body: undefined,
      },
    ]);
    // A link writes an access row, not a document: nothing to refresh.
    expect(seen.onSuccess).toBeNull();
  });
});

describe("a write refused because the list is out of date", () => {
  it.each([
    ["upload", () => useUploadHotelDocument(HOTEL_ID)],
    ["delete", () => useDeleteHotelDocument(HOTEL_ID)],
    ["link", () => useHotelDocumentLink(HOTEL_ID)],
  ])("refreshes the documents after a 409 or a 404 from the %s", (_name, hook) => {
    hook();
    seen.onError?.(new AppError("conflict", "A newer version of this document was filed since"));
    seen.onError?.(new AppError("not_found", "No such document"));
    expect(seen.invalidated).toEqual([
      hotelDocumentsQueryKey(HOTEL_ID),
      hotelDocumentsQueryKey(HOTEL_ID),
    ]);
  });

  it("leaves the list alone after a refusal of the file itself, a busy server or no network", () => {
    useUploadHotelDocument(HOTEL_ID);
    seen.onError?.(new AppError("validation_failed", "This file is protected with a password"));
    seen.onError?.(new AppError("unavailable", "The server is busy with other uploads"));
    seen.onError?.(new AppError("network_error", "offline"));
    seen.onError?.(new Error("anything else"));
    expect(seen.invalidated).toEqual([]);
  });

  it("reads a failure envelope as the API's error code", async () => {
    seen.answer = failure("conflict", 409);
    useDeleteHotelDocument(HOTEL_ID);
    await expect(mutate(DOCUMENT_ID)).rejects.toMatchObject({ code: "conflict" });
  });
});
