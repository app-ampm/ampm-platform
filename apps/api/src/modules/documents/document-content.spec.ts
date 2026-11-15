import { describe, expect, it } from "vitest";

import { detectDocument, downloadFileName } from "./document-content.js";

const bytes = (...parts: Array<string | number[]>): Buffer =>
  Buffer.concat(
    parts.map((part) => (typeof part === "string" ? Buffer.from(part) : Buffer.from(part))),
  );

describe("detectDocument — type by content, never by name (D-132)", () => {
  it.each([
    ["a PDF", bytes("%PDF-1.7\n"), "application/pdf"],
    ["a JPEG", bytes([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    ["a PNG", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
  ])("recognises %s", (_name, content, mimeType) => {
    expect(detectDocument(content)?.mimeType).toBe(mimeType);
  });

  it.each([
    ["an executable named .pdf", bytes("MZ", "contract.pdf")],
    ["an HTML page", bytes("<!doctype html><script>")],
    ["a truncated PDF header", bytes("%PD")],
    ["an empty file", Buffer.alloc(0)],
  ])("refuses %s", (_name, content) => {
    expect(detectDocument(content)).toBeNull();
  });
});

describe("downloadFileName — PII-free, versioned", () => {
  it("names the first version plainly and later ones with their number", () => {
    expect(downloadFileName("contract", 1, "application/pdf")).toBe("contract.pdf");
    expect(downloadFileName("contract", 3, "image/jpeg")).toBe("contract-v3.jpg");
  });

  it("falls back to .bin for a type it does not know", () => {
    expect(downloadFileName("contract", 1, "text/html")).toBe("contract.bin");
  });
});
