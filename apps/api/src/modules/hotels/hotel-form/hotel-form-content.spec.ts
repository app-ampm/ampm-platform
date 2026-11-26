import { createHash } from "node:crypto";

import { canonicalJson } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { canonicalContentOf, wholeContentOf } from "./hotel-form-content.js";

/*
 * What a section's (and a revision's) answers are stored and hashed as (D-190 §1 and §3): their canonical
 * JSON, so a null-valued key and a missing key are one content, with one SHA-256, and the bytes a
 * section's cap counts. Synthetic answers only.
 */

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

describe("canonicalContentOf", () => {
  it("stores and hashes a null-valued key and a missing key as one content", () => {
    const withNulls = canonicalContentOf({ name: "Synthetic Lake Palace", city: null, rows: [] });
    const without = canonicalContentOf({ name: "Synthetic Lake Palace" });
    expect(withNulls.hash).toBe(without.hash);
    expect(withNulls.json).toEqual({ name: "Synthetic Lake Palace" });
    expect(Object.keys(withNulls.json)).toEqual(["name"]);
  });

  it("hashes the canonical text: keys in order, nested blanks left out, list places kept", () => {
    const answers = { totalRooms: 40, rows: [{ rowId: "r1", name: "Lake Room", notes: null }] };
    const content = canonicalContentOf(answers);
    expect(content.hash).toBe(sha256(canonicalJson(answers)));
    expect(content.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalContentOf({ rows: answers.rows, totalRooms: 40 }).hash).toBe(content.hash);
    expect(content.json).toEqual({ rows: [{ name: "Lake Room", rowId: "r1" }], totalRooms: 40 });
  });

  it("counts the canonical text's UTF-8 bytes, as the section's cap does", () => {
    expect(canonicalContentOf({ name: "महल" }).bytes).toBe('{"name":"महल"}'.length - 3 + 9);
    expect(canonicalContentOf({}).bytes).toBe(2);
  });

  it("keeps false, 0 and an empty text, which are answers", () => {
    expect(canonicalContentOf({ isChain: false, totalRooms: 0, name: "" }).json).toEqual({
      isChain: false,
      name: "",
      totalRooms: 0,
    });
  });
});

describe("wholeContentOf: a revision, kept whole", () => {
  it("keeps every member as read, an empty section's answers included, so core's revision schema reads it", () => {
    const revision = {
      property: { schemaVersion: 1, noChanges: false, answers: { name: "Synthetic Lake Palace" } },
      rooms: { schemaVersion: 1, noChanges: false, answers: {} },
    };
    const whole = wholeContentOf(revision);
    expect(whole.json).toEqual(revision);
    // Hashed as its canonical JSON, as canonicalContentOf hashes it: the stored JSON hashes the same.
    expect(whole.hash).toBe(canonicalContentOf(revision).hash);
    expect(whole.hash).toBe(sha256(canonicalJson(whole.json)));
    expect(canonicalContentOf(revision).json).toEqual({
      property: revision.property,
      rooms: { noChanges: false, schemaVersion: 1 },
    });
  });
});
