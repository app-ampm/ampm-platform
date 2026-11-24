import { describe, expect, it } from "vitest";

import {
  CONTENT_KINDS,
  contentKind,
  contentKindOfMimeType,
  type ContentKind,
} from "./content-kinds.js";

describe("CONTENT_KINDS (D-187 §2)", () => {
  it("describes every kind the content checks decide, and nothing else", () => {
    expect(Object.keys(CONTENT_KINDS).sort()).toEqual([...contentKind.options].sort());
    expect(contentKind.options).toEqual([
      "pdf",
      "jpeg",
      "png",
      "webp",
      "gif",
      "mp4",
      "pptx",
      "ppsx",
      "potx",
      "ppt",
      "xlsx",
      "xltx",
      "xls",
    ]);
  });

  it("serves each kind with a media type and a download extension", () => {
    for (const [kind, info] of Object.entries(CONTENT_KINDS)) {
      expect(info.mimeType, kind).toMatch(/^(application|image|video)\/[a-z0-9.+-]+$/);
      expect(info.extension, kind).toMatch(/^[a-z0-9]{3,4}$/);
    }
    expect(CONTENT_KINDS.ppt.mimeType).toBe("application/vnd.ms-powerpoint");
    expect(CONTENT_KINDS.jpeg.extension).toBe("jpg");
  });

  it("gives each kind its own media type, so a stored type names one kind", () => {
    const types = Object.values(CONTENT_KINDS).map((info) => info.mimeType);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("contentKindOfMimeType", () => {
  it.each<[string, ContentKind]>([
    ["application/pdf", "pdf"],
    ["image/jpeg", "jpeg"],
    ["video/mp4", "mp4"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
    ["application/vnd.ms-excel", "xls"],
  ])("reads %s as %s", (mimeType, kind) => {
    expect(contentKindOfMimeType(mimeType)).toBe(kind);
  });

  it("knows no kind for a type the checks never store", () => {
    expect(contentKindOfMimeType("text/html")).toBeNull();
    expect(contentKindOfMimeType("")).toBeNull();
  });
});
