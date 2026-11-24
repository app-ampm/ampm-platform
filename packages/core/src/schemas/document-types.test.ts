import { describe, expect, it } from "vitest";

import { contentKind } from "./content-kinds.js";
import {
  DOCUMENT_TYPE_RULES,
  DOCUMENT_TYPES,
  documentType,
  documentTypeKinds,
  documentTypeLabel,
  documentTypeMaxBytes,
  HOTEL_DOCUMENT_TYPES,
  hotelDocumentType,
  isHotelDocumentType,
  type DocumentType,
} from "./document-types.js";

const MIB = 1024 * 1024;
const PDF_JPEG_PNG_20 = { pdf: 20 * MIB, jpeg: 20 * MIB, png: 20 * MIB };

describe("DOCUMENT_TYPES", () => {
  it("lists every stored type and the three the hotel library adds (D-187 §3)", () => {
    expect(DOCUMENT_TYPES).toEqual([
      "proposal",
      "contract",
      "invoice",
      "design",
      "menu",
      "schedule",
      "rooming_list",
      "rider",
      "ticket",
      "consent",
      "other",
      "fact_sheet",
      "beverage_menu",
      "floor_plan",
    ]);
    expect(documentType.options).toEqual(DOCUMENT_TYPES);
  });

  it("labels every type for staff, `menu` as the food menu", () => {
    expect(documentTypeLabel("menu")).toBe("Food menu");
    expect(documentTypeLabel("beverage_menu")).toBe("Beverage menu");
    expect(documentTypeLabel("fact_sheet")).toBe("Fact sheet");
    expect(documentTypeLabel("floor_plan")).toBe("Floor plan");
    for (const type of DOCUMENT_TYPES) {
      const label = documentTypeLabel(type);
      expect(label, type).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
      expect(label.length, type).toBeLessThanOrEqual(120);
    }
  });
});

describe("DOCUMENT_TYPE_RULES: the kinds each type takes, and a cap per kind (D-187 §3)", () => {
  it("takes a fact sheet as a PDF of 20 MiB or a presentation of 25 MiB", () => {
    expect(DOCUMENT_TYPE_RULES.fact_sheet).toEqual({
      pdf: 20 * MIB,
      pptx: 25 * MIB,
      ppsx: 25 * MIB,
      potx: 25 * MIB,
      ppt: 25 * MIB,
    });
  });

  it.each<DocumentType>(["menu", "beverage_menu"])(
    "takes a %s as a PDF or an image of 20 MiB, or a workbook of 10 MiB",
    (type) => {
      expect(DOCUMENT_TYPE_RULES[type]).toEqual({
        ...PDF_JPEG_PNG_20,
        xlsx: 10 * MIB,
        xltx: 10 * MIB,
        xls: 10 * MIB,
      });
    },
  );

  it("takes every other type as a PDF, JPEG or PNG of 20 MiB, as before", () => {
    const others = DOCUMENT_TYPES.filter(
      (type) => !["fact_sheet", "menu", "beverage_menu"].includes(type),
    );
    expect(others).toContain("floor_plan");
    for (const type of others) expect(DOCUMENT_TYPE_RULES[type], type).toEqual(PDF_JPEG_PNG_20);
  });

  it("names only kinds the content checks decide, never a media-only kind", () => {
    for (const type of DOCUMENT_TYPES) {
      const kinds = documentTypeKinds(type);
      expect(
        kinds.every((kind) => contentKind.options.includes(kind)),
        type,
      ).toBe(true);
      expect(kinds, type).not.toContain("mp4");
      expect(kinds, type).not.toContain("webp");
      expect(kinds, type).not.toContain("gif");
    }
  });

  it("gives the kinds a type takes and the largest file it takes", () => {
    expect(documentTypeKinds("floor_plan")).toEqual(["pdf", "jpeg", "png"]);
    expect(documentTypeMaxBytes("fact_sheet")).toBe(25 * MIB);
    expect(documentTypeMaxBytes("menu")).toBe(20 * MIB);
    expect(documentTypeMaxBytes("contract")).toBe(20 * MIB);
  });
});

describe("HOTEL_DOCUMENT_TYPES: what a hotel's documents library files (D-187 §6)", () => {
  it("is the fact sheet, the food and beverage menus, the floor plan and other", () => {
    expect(HOTEL_DOCUMENT_TYPES).toEqual([
      "fact_sheet",
      "menu",
      "beverage_menu",
      "floor_plan",
      "other",
    ]);
    expect(hotelDocumentType.options).toEqual(HOTEL_DOCUMENT_TYPES);
    for (const type of HOTEL_DOCUMENT_TYPES) expect(DOCUMENT_TYPES).toContain(type);
  });

  it("tells a hotel document type from the others", () => {
    expect(isHotelDocumentType("floor_plan")).toBe(true);
    expect(isHotelDocumentType("contract")).toBe(false);
    expect(isHotelDocumentType("Floor plan")).toBe(false);
  });
});
