import { CONTENT_KINDS } from "@ampm/core";
import type { PickedFile } from "@ampm/ui";

import {
  buildDocumentUpload,
  draftForUpload,
  fileSizeError,
  titleHint,
  validateDocumentUpload,
} from "./document-upload.form";
import { DOCUMENT_ID, hotelDocumentFixture } from "./hotel-documents.test-utils";

const MIB = 1024 * 1024;

function picked(overrides: Partial<PickedFile> = {}): PickedFile {
  return {
    file: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
    name: "menu.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2 * MIB,
    ...overrides,
  };
}

describe("the upload sheet's draft", () => {
  it("starts a new document with nothing chosen, and a new version from the document it replaces", () => {
    expect(draftForUpload(null)).toEqual({ type: null, title: "", file: null });
    expect(draftForUpload(hotelDocumentFixture())).toEqual({
      type: "menu",
      title: "Banquet menu",
      file: null,
    });
  });

  it("asks for a type and a file before anything is sent", () => {
    expect(validateDocumentUpload(draftForUpload(null))).toEqual({
      type: "Choose what this document is",
      title: undefined,
      file: "Choose the file to upload",
    });
    const ready = { type: "menu" as const, title: "", file: picked() };
    expect(validateDocumentUpload(ready)).toEqual({
      type: undefined,
      title: undefined,
      file: undefined,
    });
  });

  it("keeps a title to 120 characters, counted once trimmed", () => {
    const base = { type: "menu" as const, file: picked() };
    expect(validateDocumentUpload({ ...base, title: ` ${"a".repeat(120)} ` }).title).toBe(
      undefined,
    );
    expect(validateDocumentUpload({ ...base, title: "a".repeat(121) }).title).toBe(
      "Keep the title to 120 characters",
    );
  });

  it("checks the picked file against the chosen type's limit for its kind", () => {
    const workbook = picked({
      name: "menu.xlsx",
      mimeType: CONTENT_KINDS.xlsx.mimeType,
      sizeBytes: 11 * MIB,
    });
    expect(fileSizeError({ type: "menu", title: "", file: workbook })).toBe(
      "This Excel file is over the 10 MB limit for food menus",
    );
    expect(validateDocumentUpload({ type: "menu", title: "", file: workbook }).file).toBe(
      "This Excel file is over the 10 MB limit for food menus",
    );
    // Nothing to say about the size before the type is chosen.
    expect(fileSizeError({ type: null, title: "", file: workbook })).toBe(undefined);
  });

  it("says what a blank title becomes", () => {
    expect(titleHint("beverage_menu", null)).toBe(
      "Optional. Left blank, it is called “Beverage menu”.",
    );
    expect(titleHint(null, null)).toBe("Optional. Left blank, it takes the name of its type.");
  });

  it("says a new version left without a title keeps its document's title", () => {
    expect(titleHint("menu", hotelDocumentFixture())).toBe(
      "Optional. Left blank, it keeps its title “Banquet menu”.",
    );
  });
});

describe("buildDocumentUpload", () => {
  it("sends the type, a trimmed title and the file of a new document", () => {
    const file = picked();
    expect(
      buildDocumentUpload({ type: "fact_sheet", title: "  Fact sheet 2027 ", file }, null),
    ).toEqual({ type: "fact_sheet", title: "Fact sheet 2027", file: file.file });
  });

  it("leaves a blank title out, so the API names the document after its type", () => {
    const file = picked();
    expect(buildDocumentUpload({ type: "floor_plan", title: "   ", file }, null)).toEqual({
      type: "floor_plan",
      file: file.file,
    });
  });

  it("names the document a new version replaces", () => {
    const file = picked();
    const draft = { ...draftForUpload(hotelDocumentFixture()), file };
    expect(buildDocumentUpload(draft, hotelDocumentFixture())).toEqual({
      type: "menu",
      title: "Banquet menu",
      replaces: DOCUMENT_ID,
      file: file.file,
    });
  });

  it("builds nothing without a type or a file", () => {
    expect(buildDocumentUpload({ type: null, title: "", file: picked() }, null)).toBeNull();
    expect(buildDocumentUpload({ type: "menu", title: "", file: null }, null)).toBeNull();
  });
});
