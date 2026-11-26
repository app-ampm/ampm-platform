import { describe, expect, it } from "vitest";

import { canonicalJson, utf8ByteLength } from "./canonical-json";

/*
 * The canonical JSON the hotel form's sections and revisions are hashed and measured by (D-190 §1 and
 * §2): one text for one content, whatever the key order or the blanks, so the API and the site agree on
 * "unchanged" and the API's SHA-256 of it is the stored content hash.
 */
describe("canonicalJson", () => {
  it("orders every object's keys and writes no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: true, c: "x" } })).toBe('{"a":{"c":"x","d":true},"b":1}');
    expect(canonicalJson({ a: { c: "x", d: true }, b: 1 })).toBe(
      canonicalJson({ b: 1, a: { d: true, c: "x" } }),
    );
  });

  it("orders keys that look like numbers as text, where JSON.stringify would not", () => {
    expect(canonicalJson({ "2": "b", "10": "a", x: "c" })).toBe('{"10":"a","2":"b","x":"c"}');
  });

  it("leaves out a blank member: undefined, null, an empty list or an object left empty", () => {
    expect(canonicalJson({ a: null, b: undefined, c: [], d: {}, e: { f: null }, g: 0 })).toBe(
      '{"g":0}',
    );
    expect(canonicalJson({ name: null })).toBe(canonicalJson({}));
    expect(canonicalJson({})).toBe("{}");
  });

  it("keeps false, zero and empty text, which are answers", () => {
    expect(canonicalJson({ isChain: false, rooms: 0, note: "" })).toBe(
      '{"isChain":false,"note":"","rooms":0}',
    );
  });

  it("keeps a list's entries in order and in place, a blank one included", () => {
    expect(canonicalJson({ rows: [{ b: 2, a: 1 }, {}, { a: null }] })).toBe(
      '{"rows":[{"a":1,"b":2},{},{}]}',
    );
    expect(canonicalJson([null, 1, "x"])).toBe('[null,1,"x"]');
    expect(canonicalJson({ rows: [{}] })).not.toBe(canonicalJson({}));
  });

  it("writes numbers and text as JSON does, minus zero as zero", () => {
    expect(canonicalJson({ km: 12.5, minutes: -0, label: 'Say "hi"\n', hindi: "महल" })).toBe(
      '{"hindi":"महल","km":12.5,"label":"Say \\"hi\\"\\n","minutes":0}',
    );
  });

  it("keeps a __proto__ member as JSON.parse makes it, never dropping it or merging it into its object", () => {
    const parsed: unknown = JSON.parse('{"__proto__":{"a":1},"b":2}');
    expect(canonicalJson(parsed)).toBe('{"__proto__":{"a":1},"b":2}');
    expect(canonicalJson(parsed)).not.toBe(canonicalJson({ b: 2 }));
    const nested: unknown = JSON.parse('{"rows":[{"__proto__":{"b":2}}]}');
    expect(canonicalJson(nested)).toBe('{"rows":[{"__proto__":{"b":2}}]}');
    expect(canonicalJson(nested)).not.toBe(canonicalJson({ rows: [{ b: 2 }] }));
    expect(Object.prototype).not.toHaveProperty("a");
  });

  it("refuses what JSON cannot carry: a non-finite number, a date, a map, a function", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, new Date(0), new Map(), () => 1]) {
      expect(() => canonicalJson({ value }), String(value)).toThrow();
    }
    expect(() => canonicalJson(10n)).toThrow();
  });
});

describe("utf8ByteLength", () => {
  it("counts the bytes UTF-8 takes: 1 for ASCII, 2 or 3 in the BMP, 4 for a surrogate pair", () => {
    expect(utf8ByteLength("")).toBe(0);
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("₹")).toBe(3);
    expect(utf8ByteLength("महल")).toBe(9);
    expect(utf8ByteLength("😀")).toBe(4);
    expect(utf8ByteLength('{"a":"😀é"}')).toBe(14);
  });

  it("counts a lone surrogate as the replacement character a UTF-8 encoder writes", () => {
    expect(utf8ByteLength("\ud800")).toBe(3);
    expect(utf8ByteLength("a\udc00")).toBe(4);
  });
});
