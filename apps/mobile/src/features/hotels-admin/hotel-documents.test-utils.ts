import type { QueryClient } from "@tanstack/react-query";

import {
  CONTENT_KINDS,
  type HotelDocumentVersionView,
  type HotelDocumentView,
  type StaffRoleCode,
} from "@ampm/core";

import { failure, ok, TEST_API_BASE, type FetchFn } from "../../test/api";
import { act, waitFor } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import {
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  rateCardViewFixture,
} from "./hotels-admin.test-utils";

/*
 * Test helpers for the staff hotel record's Documents tab (D-187 §6): a hotel's documents in the shape
 * `GET …/documents` returns them, and a fetch that answers the tab's routes and records every write
 * with its query and body type. Imported by tests only.
 */

export const DOCUMENT_ID = "018f0000-0000-7000-8000-0000000c1403";
export const EARLIER_VERSION_ID = "018f0000-0000-7000-8000-0000000c1402";
export const FACT_SHEET_ID = "018f0000-0000-7000-8000-0000000c1401";
export const DOCUMENTS = `/hotels-admin/hotels/${HOTEL_ID}/documents`;
export const LINK_PATH = "/documents/links/018f0000-0000-7000-8000-00000000a222/token";

/** The earlier version of the banquet menu: a 1.2 MB PDF from 3 October. */
export function documentVersionFixture(
  overrides: Partial<HotelDocumentVersionView> = {},
): HotelDocumentVersionView {
  return {
    id: EARLIER_VERSION_ID,
    documentType: "menu",
    title: "Banquet menu 2025",
    mimeType: "application/pdf",
    sizeBytes: 1_258_291,
    versionNumber: 1,
    createdAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  };
}

/** The hotel's banquet menu: version 2, a 2.4 MB PDF from 12 November, with version 1 before it. */
export function hotelDocumentFixture(
  overrides: Partial<HotelDocumentView> = {},
): HotelDocumentView {
  return {
    id: DOCUMENT_ID,
    hotelId: HOTEL_ID,
    documentType: "menu",
    title: "Banquet menu",
    mimeType: "application/pdf",
    sizeBytes: 2_516_582,
    versionNumber: 2,
    createdAt: "2026-11-12T12:00:00.000Z",
    versions: [documentVersionFixture()],
    ...overrides,
  };
}

/** The hotel's fact sheet: a single 5 MB PowerPoint presentation. */
export function factSheetFixture(overrides: Partial<HotelDocumentView> = {}): HotelDocumentView {
  return hotelDocumentFixture({
    id: FACT_SHEET_ID,
    documentType: "fact_sheet",
    title: "Fact sheet",
    mimeType: CONTENT_KINDS.pptx.mimeType,
    sizeBytes: 5 * 1024 * 1024,
    versionNumber: 1,
    versions: [],
    ...overrides,
  });
}

/** One write the tab sent: its method, path and query, how its body went, and the JSON if any. */
export interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly contentType: string | null;
  readonly json: unknown;
}

export interface DocumentsApi {
  readonly documents?: readonly HotelDocumentView[];
  readonly roles?: readonly StaffRoleCode[];
  /** A custom role's capability ids (D-164), to grant one action at a time. */
  readonly capabilities?: readonly string[];
  /** The answer to an upload; a filed new version of the banquet menu otherwise. */
  readonly upload?: () => Response;
  /** Every write the tab sends (never a read) is pushed here. */
  readonly sent?: SentRequest[];
}

function recordOf(path: string, query: string, init: RequestInit | undefined): SentRequest {
  const body = init?.body;
  return {
    method: init?.method ?? "GET",
    path,
    query,
    contentType: new Headers(init?.headers).get("content-type"),
    json: typeof body === "string" ? JSON.parse(body) : null,
  };
}

/** The answer to a write under the documents route: an upload, a delete or a link. */
function documentsWrite(path: string, api: DocumentsApi): Response {
  if (path === DOCUMENTS) return api.upload?.() ?? ok(hotelDocumentFixture({ versionNumber: 3 }));
  if (path.endsWith("/link")) return ok({ url: LINK_PATH, expiresAt: "2026-11-24T12:15:00.000Z" });
  return ok({ id: path.slice(DOCUMENTS.length + 1) });
}

/** A new draft rate card as the API files it: the name and source the request sent, no items. */
function createdCard(init: RequestInit | undefined): Response {
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  const sent = typeof body === "object" && body !== null ? body : {};
  const name = "name" in sent && typeof sent.name === "string" ? sent.name : "Rate card";
  const source = "source" in sent && typeof sent.source === "string" ? sent.source : null;
  return ok(rateCardViewFixture({ name, source, items: [] }));
}

/**
 * The Documents tab's API: the hotel, `/me` for the roles or a custom role's capabilities, the list and
 * its writes, and the rate cards a menu's draft F&B card is added to. Every other path is a 404.
 *
 *   await renderWithApi(<HotelDocumentsScreen hotelId={HOTEL_ID} />, documentsFetch({ documents, sent }));
 */
export function documentsFetch(api: DocumentsApi = {}): FetchFn {
  const { documents = [], roles = ["HT"], capabilities = [], sent = [] } = api;
  return (input, init) => {
    const [path = "", query = ""] = String(input).replace(TEST_API_BASE, "").split("?");
    const isWrite = (init?.method ?? "GET") !== "GET";
    if (isWrite) sent.push(recordOf(path, query, init));
    if (path === `/hotels-admin/hotels/${HOTEL_ID}`) {
      return Promise.resolve(ok(hotelStaffDetailViewFixture()));
    }
    if (path === "/me") return Promise.resolve(ok(staffMeFixture([...roles], [...capabilities])));
    if (path === `/hotels-admin/hotels/${HOTEL_ID}/rate-cards`) {
      return Promise.resolve(isWrite ? createdCard(init) : ok({ items: [] }));
    }
    if (path.startsWith(DOCUMENTS)) {
      return Promise.resolve(isWrite ? documentsWrite(path, api) : ok({ items: documents }));
    }
    return Promise.resolve(failure("not_found", 404));
  };
}

/**
 * Waits until nothing is in flight (the hotel, `/me`, the list, a refresh after a write) and the screen
 * has been handed every answer, so none lands after a test has finished, outside `act`. React Query
 * passes its results to the components on a timer (its notifyManager), after the client has settled:
 * that timer runs here, inside `act`.
 *
 *   const client = await renderWithApi(<HotelDocumentsScreen hotelId={HOTEL_ID} />, documentsFetch());
 *   await untilSettled(client);
 */
export async function untilSettled(queryClient: QueryClient): Promise<void> {
  await waitFor(() => {
    if (queryClient.isFetching() + queryClient.isMutating() > 0) throw new Error("still loading");
  });
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}
