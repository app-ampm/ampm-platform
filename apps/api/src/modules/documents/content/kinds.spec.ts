import { describe, expect, it } from "vitest";

import { CONTENT_KINDS, type ContentKind, wordRefusal } from "./kinds.js";

describe("CONTENT_KINDS", () => {
  it("serves each kind with a media type and a download extension", () => {
    for (const [kind, info] of Object.entries(CONTENT_KINDS)) {
      expect(info.mimeType, kind).toMatch(/^(application|image|video)\/[a-z0-9.+-]+$/);
      expect(info.extension, kind).toMatch(/^[a-z0-9]{3,4}$/);
    }
    expect(CONTENT_KINDS.ppt.mimeType).toBe("application/vnd.ms-powerpoint");
    expect(CONTENT_KINDS.jpeg.extension).toBe("jpg");
  });

  it("tells a Word file to save as PDF only where the upload takes PDFs", () => {
    expect(wordRefusal(new Set<ContentKind>(["pdf"]))).toBe("word_document");
    expect(wordRefusal(new Set<ContentKind>(["jpeg"]))).toBe("type_not_accepted");
  });
});
