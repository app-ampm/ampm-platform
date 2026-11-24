import type { ContentKind } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { wordRefusal } from "./kinds.js";

describe("wordRefusal", () => {
  it("tells a Word file to save as PDF only where the upload takes PDFs", () => {
    expect(wordRefusal(new Set<ContentKind>(["pdf"]))).toBe("word_document");
    expect(wordRefusal(new Set<ContentKind>(["jpeg"]))).toBe("type_not_accepted");
  });
});
