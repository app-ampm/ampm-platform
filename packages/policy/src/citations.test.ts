/**
 * A comment that quotes a §7 move with its line ("closure → closed" ... §7 line 420) sends the
 * reader to that row of docs/permission-matrix.md, so the row on that line must be that move
 * (ENGINE-7). Every source of the package is read, its tests and generated files aside.
 */
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);
const DOCUMENT = readFileSync(new URL("../../docs/permission-matrix.md", ROOT), "utf8").split("\n");
const QUOTED_MOVE = /"([a-z_]+) → ([a-z_]+)"[^"\n]*?§7 line (\d+)/g;

function sources(): string[] {
  return ["src", "scripts"].flatMap((folder) =>
    readdirSync(new URL(folder, ROOT), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => !file.startsWith("generated"))
      .map((file) => `${folder}/${file}`),
  );
}

/** The From and To cells of the §7 table row on a line of the document, or null. */
function moveOn(line: number): readonly [string, string] | null {
  const cells = (DOCUMENT[line - 1] ?? "").split("|").map((cell) => cell.trim());
  if (cells.length !== 5) return null;
  return [cells[1] ?? "", cells[2] ?? ""];
}

describe("§7 moves quoted in the package's comments", () => {
  const citations = sources().flatMap((file) =>
    [...readFileSync(new URL(file, ROOT), "utf8").matchAll(QUOTED_MOVE)].map((match) => ({
      file,
      from: match[1] ?? "",
      to: match[2] ?? "",
      line: Number(match[3]),
    })),
  );

  it("finds the citations it checks", () => {
    expect(citations.map((citation) => citation.file)).toContain("src/transitions.ts");
  });

  for (const { file, from, to, line } of citations) {
    it(`${file}: "${from} → ${to}" is the row on §7 line ${line}`, () => {
      expect(moveOn(line)).toEqual([from, to]);
    });
  }
});
