import { describe, expect, it } from "vitest";

import {
  HOTEL_DOCUMENT_TITLE_MAX,
  HOTEL_DOCUMENTS_MAX,
  hotelDocumentList,
  hotelDocumentRemovedResponse,
  hotelDocumentUploadQuery,
  hotelDocumentView,
} from "./hotel-documents.js";

const DOC = "0192f1a0-0000-7000-8000-00000000d0c1";
const HOTEL = "0192f1a0-0000-7000-8000-00000000d0c2";

const version = {
  id: DOC,
  documentType: "fact_sheet",
  title: "Fact sheet",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  versionNumber: 1,
  createdAt: "2026-11-24T10:00:00.000Z",
};

describe("hotelDocumentUploadQuery (D-187 §6)", () => {
  it("takes a hotel document type, and leaves an absent or blank title for the API to fill", () => {
    // The API names a new document after its type and keeps a replacement's current title, which only
    // it knows, so the contract fills in nothing.
    expect(hotelDocumentUploadQuery.parse({ type: "menu" })).toEqual({
      type: "menu",
      title: null,
      replaces: null,
    });
    expect(hotelDocumentUploadQuery.parse({ type: "floor_plan", title: "   " }).title).toBeNull();
    expect(hotelDocumentUploadQuery.parse({ type: "menu", replaces: DOC }).title).toBeNull();
  });

  it("trims the title and keeps it to 120 characters", () => {
    expect(HOTEL_DOCUMENT_TITLE_MAX).toBe(120);
    const parsed = hotelDocumentUploadQuery.parse({ type: "other", title: "  Spa menu 2027  " });
    expect(parsed.title).toBe("Spa menu 2027");
    const longest = "a".repeat(120);
    expect(hotelDocumentUploadQuery.parse({ type: "other", title: longest }).title).toBe(longest);
    expect(
      hotelDocumentUploadQuery.safeParse({ type: "other", title: `${longest}b` }).success,
    ).toBe(false);
    expect(hotelDocumentUploadQuery.safeParse({ type: "other", title: "a\u0000b" }).success).toBe(
      false,
    );
  });

  it("names the document a replacement follows by its id", () => {
    expect(hotelDocumentUploadQuery.parse({ type: "menu", replaces: DOC }).replaces).toBe(DOC);
    expect(hotelDocumentUploadQuery.safeParse({ type: "menu", replaces: "v1" }).success).toBe(
      false,
    );
  });

  it.each([
    ["no type", {}],
    ["a type the library does not file", { type: "contract" }],
    ["a type given twice", { type: ["menu", "menu"] }],
    ["an unknown key", { type: "menu", dryRun: "true" }],
  ])("refuses %s", (_name, query) => {
    expect(hotelDocumentUploadQuery.safeParse(query).success).toBe(false);
  });
});

describe("hotelDocumentView", () => {
  it("is a live document with its earlier versions, newest first", () => {
    const view = {
      ...version,
      id: HOTEL.replace("d0c2", "d0c3"),
      versionNumber: 2,
      hotelId: HOTEL,
      versions: [version],
    };
    expect(hotelDocumentView.parse(view)).toEqual(view);
    expect(hotelDocumentList.parse({ items: [view] }).items).toHaveLength(1);
  });

  it("is strict, in the document and in each version", () => {
    const view = { ...version, hotelId: HOTEL, versions: [] };
    expect(hotelDocumentView.safeParse({ ...view, storageKey: "documents/x" }).success).toBe(false);
    expect(
      hotelDocumentView.safeParse({ ...view, versions: [{ ...version, checksum: "abc" }] }).success,
    ).toBe(false);
    expect(hotelDocumentView.safeParse({ ...view, documentType: "contract" }).success).toBe(false);
  });

  it("answers a removal with the document's id, and caps a hotel at 100 live documents", () => {
    expect(hotelDocumentRemovedResponse.parse({ id: DOC })).toEqual({ id: DOC });
    expect(HOTEL_DOCUMENTS_MAX).toBe(100);
  });
});
