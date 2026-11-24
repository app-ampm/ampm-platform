import { UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { loggableDetail, uploadRefusal } from "./upload-refusal.js";

describe("uploadRefusal (D-187 §3)", () => {
  it("answers a type the upload does not take with 415 and the message on the file", () => {
    const message = UPLOAD_REFUSAL_MESSAGES.word_document;
    expect(uploadRefusal("word_document")).toMatchObject({
      code: "unsupported_media_type",
      status: 415,
      message,
      details: [{ path: "file", message }],
    });
  });

  it("answers anything refused inside a type it takes with 400", () => {
    expect(uploadRefusal("macros")).toMatchObject({
      code: "validation_failed",
      status: 400,
      message: UPLOAD_REFUSAL_MESSAGES.macros,
    });
  });
});

describe("loggableDetail: the rule a refusal broke, without what the file said", () => {
  it("masks every quoted name, path or address from the file", () => {
    expect(
      loggableDetail('an external image target "file:///C:/Users/Asha Rao/Pictures/lawn.jpg"'),
    ).toBe('an external image target "…"');
    expect(loggableDetail('two entries named "a\\"b" and "c"')).toBe(
      'two entries named "…" and "…"',
    );
  });

  it("keeps a rule that quotes nothing", () => {
    expect(loggableDetail("the name /JavaScript")).toBe("the name /JavaScript");
  });

  it("keeps a log line short", () => {
    expect(loggableDetail("x".repeat(1000))).toHaveLength(200);
  });
});
