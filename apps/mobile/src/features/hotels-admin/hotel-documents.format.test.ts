import { CONTENT_KINDS } from "@ampm/core";

import {
  deleteDocumentWarning,
  documentAccept,
  documentCount,
  documentFileSizeError,
  documentGroups,
  documentKindLabel,
  documentMeta,
  documentSizeText,
  documentTypeTakes,
  fbCardPrefill,
  isMenuType,
  opensInBrowser,
  pickedFileKind,
  uploadedMessage,
  versionFacts,
} from "./hotel-documents.format";
import {
  DOCUMENT_ID,
  documentVersionFixture,
  factSheetFixture,
  hotelDocumentFixture,
} from "./hotel-documents.test-utils";

const MIB = 1024 * 1024;

describe("documentGroups", () => {
  it("groups the documents by type in the library's order, keeping the newest first inside each", () => {
    const older = hotelDocumentFixture({ id: "older", title: "Lunch menu" });
    const newer = hotelDocumentFixture({ title: "Banquet menu" });
    const plan = hotelDocumentFixture({ id: "plan", documentType: "floor_plan", title: "Lawns" });
    const groups = documentGroups([factSheetFixture(), newer, older, plan]);
    expect(groups.map((group) => [group.heading, group.documents.map((d) => d.title)])).toEqual([
      ["Fact sheets", ["Fact sheet"]],
      ["Food menus", ["Banquet menu", "Lunch menu"]],
      ["Floor plans", ["Lawns"]],
    ]);
  });

  it("has no group for a type without documents", () => {
    expect(documentGroups([])).toEqual([]);
  });
});

describe("a version's line", () => {
  it("names the kind, the size and the day it was uploaded", () => {
    expect(versionFacts(documentVersionFixture())).toBe("PDF · 1.2 MB · 3 OCT 2026");
    expect(documentMeta(hotelDocumentFixture())).toBe("Version 2 · PDF · 2.4 MB · 12 NOV 2026");
    expect(documentMeta(factSheetFixture())).toBe("Version 1 · PowerPoint · 5 MB · 12 NOV 2026");
  });

  it("reads Office kinds by their program, and anything unknown as a file", () => {
    expect(documentKindLabel(CONTENT_KINDS.xls.mimeType)).toBe("Excel");
    expect(documentKindLabel(CONTENT_KINDS.ppsx.mimeType)).toBe("PowerPoint");
    expect(documentKindLabel("image/png")).toBe("PNG");
    expect(documentKindLabel("application/x-unknown")).toBe("File");
  });

  it("opens PDFs and images in the browser, and downloads Office files (D-187 §5)", () => {
    expect(opensInBrowser("application/pdf")).toBe(true);
    expect(opensInBrowser("image/jpeg")).toBe(true);
    expect(opensInBrowser("image/png")).toBe(true);
    expect(opensInBrowser(CONTENT_KINDS.pptx.mimeType)).toBe(false);
    expect(opensInBrowser(CONTENT_KINDS.xls.mimeType)).toBe(false);
  });

  it("writes sizes in bytes, kilobytes or megabytes", () => {
    expect(documentSizeText(1)).toBe("1 byte");
    expect(documentSizeText(512)).toBe("512 bytes");
    expect(documentSizeText(839_680)).toBe("820 KB");
    expect(documentSizeText(25 * MIB)).toBe("25 MB");
  });
});

describe("what a type takes", () => {
  it("says each type's kinds and their caps, as the API checks them (D-187 §3)", () => {
    expect(documentTypeTakes("fact_sheet")).toBe("PDF up to 20 MB, or PowerPoint up to 25 MB");
    expect(documentTypeTakes("menu")).toBe("PDF, JPEG or PNG up to 20 MB, or Excel up to 10 MB");
    expect(documentTypeTakes("beverage_menu")).toBe(documentTypeTakes("menu"));
    expect(documentTypeTakes("floor_plan")).toBe("PDF, JPEG or PNG up to 20 MB");
    expect(documentTypeTakes("other")).toBe("PDF, JPEG or PNG up to 20 MB");
  });

  it("narrows the picker to the type's media types and extensions, so Office files can be picked", () => {
    expect(documentAccept("floor_plan")).toBe(
      "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png",
    );
    const factSheet = documentAccept("fact_sheet").split(",");
    expect(factSheet).toEqual([
      "application/pdf",
      ".pdf",
      CONTENT_KINDS.pptx.mimeType,
      ".pptx",
      CONTENT_KINDS.ppsx.mimeType,
      ".ppsx",
      CONTENT_KINDS.potx.mimeType,
      ".potx",
      "application/vnd.ms-powerpoint",
      ".ppt",
    ]);
    expect(documentAccept("menu")).toContain(".xlsx");
    expect(documentAccept("menu")).not.toContain(".pptx");
  });

  it("offers every kind the library takes before a type is chosen, and never Word", () => {
    const all = documentAccept(null);
    for (const extension of [".pdf", ".jpg", ".png", ".pptx", ".ppt", ".xlsx", ".xls"]) {
      expect(all.split(",")).toContain(extension);
    }
    expect(all.split(",")).not.toContain(".docx");
    expect(all).not.toMatch(/msword|wordprocessingml|\.doc\b/);
  });
});

describe("the size check before an upload", () => {
  const file = (name: string, mimeType: string, sizeBytes: number) => ({
    name,
    mimeType,
    sizeBytes,
  });

  it("knows a picked file's kind by its media type, or else its extension", () => {
    expect(pickedFileKind(file("menu.xlsx", CONTENT_KINDS.xlsx.mimeType, 1))).toBe("xlsx");
    expect(pickedFileKind(file("Lawns.JPEG", "application/octet-stream", 1))).toBe("jpeg");
    expect(pickedFileKind(file("deck.potx", "", 1))).toBe("potx");
    expect(pickedFileKind(file("notes", "application/octet-stream", 1))).toBeNull();
  });

  it("holds a file to its kind's cap: a food menu's workbook to 10 MB, its PDF to 20 MB", () => {
    const workbook = file("menu.xlsx", CONTENT_KINDS.xlsx.mimeType, 12 * MIB);
    expect(documentFileSizeError("menu", workbook)).toBe(
      "This Excel file is over the 10 MB limit for food menus",
    );
    expect(documentFileSizeError("menu", file("menu.pdf", "application/pdf", 12 * MIB))).toBe(
      undefined,
    );
    expect(documentFileSizeError("menu", file("menu.pdf", "application/pdf", 20 * MIB))).toBe(
      undefined,
    );
  });

  it("holds a file of a kind the type does not take to the type's largest cap", () => {
    const unknown = file("sheet.key", "application/octet-stream", 25 * MIB + 1);
    expect(documentFileSizeError("fact_sheet", unknown)).toBe(
      "This file is over the 25 MB limit for fact sheets",
    );
    expect(documentFileSizeError("fact_sheet", { ...unknown, sizeBytes: 25 * MIB })).toBe(
      undefined,
    );
  });
});

describe("the draft F&B card a menu starts", () => {
  it("is offered on food and beverage menus only", () => {
    expect(isMenuType("menu")).toBe(true);
    expect(isMenuType("beverage_menu")).toBe(true);
    expect(isMenuType("fact_sheet")).toBe(false);
    expect(isMenuType("floor_plan")).toBe(false);
  });

  it("is named after the menu, its restricted source naming the document and its version", () => {
    expect(fbCardPrefill(hotelDocumentFixture())).toEqual({
      name: "F&B · Banquet menu",
      source: `Food menu v2 (document ${DOCUMENT_ID})`,
    });
    expect(
      fbCardPrefill(hotelDocumentFixture({ documentType: "beverage_menu", title: "Bar list" })),
    ).toEqual({
      name: "F&B · Bar list",
      source: `Beverage menu v2 (document ${DOCUMENT_ID})`,
    });
  });
});

describe("the tab's messages", () => {
  it("warns that every version goes with a deleted document", () => {
    expect(deleteDocumentWarning(hotelDocumentFixture())).toBe(
      "This deletes Banquet menu from the hotel with all 2 of its versions. Nobody can open them afterwards.",
    );
    expect(deleteDocumentWarning(factSheetFixture())).toBe(
      "This deletes Fact sheet from the hotel with its only version. Nobody can open it afterwards.",
    );
  });

  it("confirms an upload, and a replacement by its new version", () => {
    const filed = hotelDocumentFixture({ versionNumber: 3 });
    expect(uploadedMessage(filed, false)).toBe("Banquet menu uploaded");
    expect(uploadedMessage(filed, true)).toBe("Banquet menu is now version 3");
  });

  it("counts the documents against the library's cap", () => {
    expect(documentCount(1)).toBe("1 of 100 documents");
    expect(documentCount(42)).toBe("42 of 100 documents");
  });
});
