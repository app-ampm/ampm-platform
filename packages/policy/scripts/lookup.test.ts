/**
 * The usage examples of the notes tables (code.md: every export's JSDoc carries a usage example)
 * must say what lookup() returns: a developer reads "hotel lines" off lookup.ts as the condition to
 * pass decide(), so a wrong example sends the wrong facts (ENGINE-7).
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { lookup } from "./lookup.ts";
import {
  OTHER_NOTES,
  OTHER_PREFIXES,
  OTHER_VERBS,
  READINGS,
  REPORT_EXCLUSIONS,
  STAFF_NOTES,
} from "./notes.ts";

const TABLES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  STAFF_NOTES,
  OTHER_NOTES,
  OTHER_PREFIXES,
  OTHER_VERBS,
  READINGS,
  REPORT_EXCLUSIONS,
};

/** ` * lookup(TABLE, "text")?.path; // value` in a JSDoc block. */
const EXAMPLE = /^\s*\*\s*lookup\((\w+), "([^"]+)"\)((?:\?\.\w+)*); \/\/ (.+)$/;

/** An example's value, written as a JavaScript literal, read as JSON. */
function literal(text: string): unknown {
  return JSON.parse(text.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":'));
}

function at(value: unknown, path: string): unknown {
  return path
    .split("?.")
    .filter((step) => step !== "")
    .reduce<unknown>((current, step) => {
      if (typeof current !== "object" || current === null) return undefined;
      return Object.entries(current).find(([key]) => key === step)?.[1];
    }, value);
}

describe("the notes tables' usage examples", () => {
  const examples = ["./lookup.ts", "./notes.ts"].flatMap((file) =>
    readFileSync(new URL(file, import.meta.url), "utf8")
      .split("\n")
      .flatMap((line) => {
        const match = EXAMPLE.exec(line);
        return match ? [{ file, table: match[1] ?? "", text: match[2] ?? "", match }] : [];
      }),
  );

  it("finds the examples it checks", () => {
    expect(examples.map((example) => example.file)).toContain("./lookup.ts");
    expect(examples.length).toBeGreaterThanOrEqual(7);
  });

  for (const { file, table, text, match } of examples) {
    it(`${file}: lookup(${table}, "${text}") returns what its example says`, () => {
      const found = TABLES[table];
      expect(found, `no table ${table}`).toBeDefined();
      const value = at(lookup(found ?? {}, text), match[3] ?? "");
      expect(value).toEqual(literal(match[4] ?? ""));
    });
  }
});
