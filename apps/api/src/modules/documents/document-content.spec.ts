import { describe, expect, it } from "vitest";

import { downloadFileName } from "./document-content.js";

describe("downloadFileName: PII-free, versioned, with the detected kind's extension (D-187 §5)", () => {
  it("names the first version plainly and later ones with their number", () => {
    expect(downloadFileName("contract", 1, "application/pdf")).toBe("contract.pdf");
    expect(downloadFileName("contract", 3, "image/jpeg")).toBe("contract-v3.jpg");
  });

  it.each([
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "fact_sheet.pptx",
    ],
    ["application/vnd.ms-powerpoint", "fact_sheet.ppt"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "fact_sheet.xlsx"],
    ["application/vnd.ms-excel", "fact_sheet.xls"],
  ])("names an Office file of type %s %s", (mimeType, name) => {
    expect(downloadFileName("fact_sheet", 1, mimeType)).toBe(name);
  });

  it("falls back to .bin for a type it does not know", () => {
    expect(downloadFileName("contract", 1, "text/html")).toBe("contract.bin");
  });
});
