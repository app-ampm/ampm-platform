import { hotelDocumentView } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { DocumentRow } from "../documents/documents.repository.js";
import { byType, isHotelDocument, toHotelDocumentView } from "./hotel-documents.view.js";

const HOTEL = "0192f1a0-0000-7000-8000-0000000000a1";

const row = (id: string, documentType: string, versionNumber = 1): DocumentRow =>
  ({
    id,
    ownerType: "hotel",
    ownerId: HOTEL,
    title: "Sample Hotel",
    documentType,
    mimeType: "application/pdf",
    sizeBytes: 1200,
    versionNumber,
    previousVersionId: null,
    visibility: "internal",
    uploadedBy: "0192f1a0-0000-7000-8000-0000000000b1",
    createdAt: new Date(Date.UTC(2026, 10, 24, 10, versionNumber)),
  }) as DocumentRow;

const id = (n: number) => `0192f1a0-0000-7000-8000-00000000000${n}`;

describe("the hotel document view (D-187 §6)", () => {
  it("is the core model: the latest version with its earlier versions, and nothing else", () => {
    const view = toHotelDocumentView(HOTEL, {
      latest: row(id(2), "menu", 2),
      earlier: [row(id(1), "menu", 1)],
    });
    expect(hotelDocumentView.parse(view)).toEqual(view);
    expect(view).toMatchObject({ id: id(2), hotelId: HOTEL, versionNumber: 2 });
    expect(view.versions.map((version) => version.id)).toEqual([id(1)]);
    expect(JSON.stringify(view)).not.toMatch(/uploadedBy|visibility|ownerId/);
  });

  it("lists by type in the library's order, keeping the newest first within a type", () => {
    const views = [
      row(id(1), "other"),
      row(id(2), "menu"),
      row(id(3), "fact_sheet"),
      row(id(4), "menu"),
    ].map((latest) => toHotelDocumentView(HOTEL, { latest, earlier: [] }));
    expect(views.sort(byType).map((view) => view.id)).toEqual([id(3), id(2), id(4), id(1)]);
  });

  it("leaves out a document of a type the library does not file", () => {
    expect(isHotelDocument({ latest: row(id(1), "contract"), earlier: [] })).toBe(false);
    expect(isHotelDocument({ latest: row(id(2), "floor_plan"), earlier: [] })).toBe(true);
  });
});
