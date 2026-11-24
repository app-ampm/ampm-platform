import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../errors.js";
import {
  UPLOAD_REFUSAL_MESSAGES,
  UPLOAD_REFUSAL_REASONS,
  uploadRefusalErrorCode,
  type UploadRefusalReason,
} from "./upload-refusals.js";

describe("UPLOAD_REFUSAL_MESSAGES", () => {
  it("has one short message for every reason, and nothing else", () => {
    expect(Object.keys(UPLOAD_REFUSAL_MESSAGES).sort()).toEqual([...UPLOAD_REFUSAL_REASONS].sort());
    for (const reason of UPLOAD_REFUSAL_REASONS) {
      const message = UPLOAD_REFUSAL_MESSAGES[reason];
      expect(message.length).toBeGreaterThan(20);
      expect(message.length).toBeLessThanOrEqual(160);
      expect(message.endsWith(".")).toBe(true);
    }
  });

  it("lists each reason once", () => {
    expect(new Set(UPLOAD_REFUSAL_REASONS).size).toBe(UPLOAD_REFUSAL_REASONS.length);
  });

  it.each<[UploadRefusalReason, string]>([
    ["word_document", "save it as a PDF"],
    ["pdf_active_content", "save it as a plain PDF"],
    ["pdf_unreadable", "save it as a plain PDF"],
    ["password_protected", "remove the password and upload it again"],
    ["heif_image", "save it as a JPEG or PNG"],
    ["image_undecodable", "save a new copy"],
  ])("tells the uploader what to do for %s (D-187)", (reason, advice) => {
    expect(UPLOAD_REFUSAL_MESSAGES[reason]).toContain(advice);
  });

  it("never names a price, a path or a technical code", () => {
    for (const message of Object.values(UPLOAD_REFUSAL_MESSAGES)) {
      expect(message).not.toMatch(/₹|\bRs\b|\bINR\b|\/|_|\b\d{3,}\b/);
    }
  });
});

describe("uploadRefusalErrorCode", () => {
  it.each<UploadRefusalReason>([
    "unknown_type",
    "type_not_accepted",
    "word_document",
    "heif_image",
  ])("answers %s with 415: not a type this upload takes", (reason) => {
    expect(uploadRefusalErrorCode(reason)).toBe("unsupported_media_type");
    expect(ERROR_CODES[uploadRefusalErrorCode(reason)]).toBe(415);
  });

  it("answers every other reason with 400: refused inside a type the upload takes", () => {
    const inside = UPLOAD_REFUSAL_REASONS.filter(
      (reason) => uploadRefusalErrorCode(reason) === "validation_failed",
    );
    expect(inside).toEqual([
      "too_large",
      "polyglot",
      "file_damaged",
      "archive_unsafe",
      "archive_expansion",
      "password_protected",
      "macros",
      "active_content",
      "external_content",
      "pdf_active_content",
      "pdf_unreadable",
      "image_too_many_pixels",
      "image_undecodable",
    ]);
    expect(ERROR_CODES.validation_failed).toBe(400);
  });
});

describe("the image refusals (D-187 §4)", () => {
  it("refuses an image over the pixel limit in D-187's words", () => {
    expect(UPLOAD_REFUSAL_MESSAGES.image_too_many_pixels).toBe(
      "Images can be at most 25 megapixels: save it as a PDF or a smaller image.",
    );
  });

  it("come last: they are decided after the content checks and the scan", () => {
    expect(UPLOAD_REFUSAL_REASONS.slice(-2)).toEqual([
      "image_too_many_pixels",
      "image_undecodable",
    ]);
  });
});
