import { describe, expect, it, vi } from "vitest";

import { sendFile, type ServedFile } from "./file-response.js";

/** The headers and body a file response sends. */
function served(file: Omit<ServedFile, "bytes" | "cacheControl">) {
  const headers = new Map<string, string>();
  const send = vi.fn();
  const res = { setHeader: (name: string, value: string) => headers.set(name, value), send };
  const bytes = Buffer.from("bytes");
  sendFile(res as never, { ...file, bytes, cacheControl: "private, no-store" });
  expect(send).toHaveBeenCalledWith(bytes);
  return Object.fromEntries(headers);
}

describe("sendFile: a stored file, served restrictively (D-187 §5)", () => {
  it("serves a PDF inline under its detected type, with no active content and same-site only", () => {
    expect(served({ mimeType: "application/pdf", fileName: "contract.pdf" })).toEqual({
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-site",
      "Content-Disposition": 'inline; filename="contract.pdf"',
      "Cache-Control": "private, no-store",
    });
  });

  it.each([
    ["image/jpeg", "consent.jpg"],
    ["image/png", "floor-plan.png"],
    ["image/webp", "image.webp"],
    ["image/gif", "image.gif"],
  ])("serves a raster image (%s) inline in a sandbox", (mimeType, fileName) => {
    expect(served({ mimeType, fileName })).toMatchObject({
      "Content-Type": mimeType,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": `inline; filename="${fileName}"`,
    });
  });

  it.each([
    ["video/mp4", "video.mp4"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "fact-sheet.pptx",
    ],
    ["application/vnd.ms-excel", "menu.xls"],
    ["application/octet-stream", "contract.bin"],
  ])("serves anything else (%s) as a download", (mimeType, fileName) => {
    expect(served({ mimeType, fileName })).toMatchObject({
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-site",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
  });
});
