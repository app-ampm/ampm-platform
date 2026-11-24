import { describe, expect, it } from "vitest";

import { refusalOf } from "./testing/refusals.js";
import { opcKey, refuseDuplicateNames, refuseUnsafeName } from "./zip-names.js";

describe("opcKey: how Office compares part names", () => {
  it.each([
    ["PPT/Slides/Slide1.XML", "ppt/slides/slide1.xml"],
    ["ppt/media/image%201.png", "ppt/media/image 1.png"],
    ["caf\u0065\u0301.xml", "caf\u00e9.xml"],
    ["bad%zz%e9.xml", "bad%zz%e9.xml"],
  ])("normalises %j to %j", (name, key) => {
    expect(opcKey(name)).toBe(key);
  });
});

describe("refuseUnsafeName", () => {
  it.each(["ppt/slides/slide1.xml", "[Content_Types].xml", "ppt/", "_rels/.rels"])(
    "allows %j",
    (name) => {
      expect(() => refuseUnsafeName(name)).not.toThrow();
    },
  );

  it.each([
    "",
    "/abs.xml",
    "a\\b.xml",
    "C:/x.xml",
    "a/../b.xml",
    "a/./b.xml",
    "a//b.xml",
    "%2E%2E/x",
    "a\0b",
  ])("refuses %j", async (name) => {
    expect((await refusalOf(() => refuseUnsafeName(name))).reason).toBe("archive_unsafe");
  });
});

describe("refuseDuplicateNames", () => {
  it("refuses names that are one part to Office, and allows distinct ones", async () => {
    expect(() => refuseDuplicateNames(["a.xml", "b.xml"])).not.toThrow();
    expect((await refusalOf(() => refuseDuplicateNames(["A.xml", "a%2Exml"]))).reason).toBe(
      "archive_unsafe",
    );
  });
});
