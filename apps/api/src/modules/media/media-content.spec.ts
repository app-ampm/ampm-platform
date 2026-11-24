import { describe, expect, it } from "vitest";

import { mediaFileName } from "./media-content.js";

describe("mediaFileName: a PII-free name with the detected extension (D-187 §5)", () => {
  it.each([
    ["image/jpeg", "image.jpg"],
    ["image/png", "image.png"],
    ["image/webp", "image.webp"],
    ["image/gif", "image.gif"],
    ["video/mp4", "video.mp4"],
  ])("names %s %s", (mimeType, name) => {
    expect(mediaFileName(mimeType)).toBe(name);
  });

  it("falls back to .bin for a type it does not know", () => {
    expect(mediaFileName("application/x-unknown")).toBe("media.bin");
  });
});
