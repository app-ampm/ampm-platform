/**
 * authz:generate — reads docs/permission-matrix.md and writes src/generated/matrix.json:
 *   staff        §5  every row × role, §5.16 reports included, as grants with scope and conditions
 *   others       §6  the client representative, guest and demo columns, scoped to their own
 *   transitions  §7  every From → To clause with the roles, people and system that may move it
 * The parsers stop on any cell, note, row or status they cannot read, so the document stays the
 * source of truth and nothing in it is dropped; CI fails when the committed file drifts from it.
 * Node type stripping, erasable TypeScript only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseMatrix } from "./parse-matrix.ts";
import { parseTransitions } from "./parse-transitions.ts";

const here = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(join(here, "..", "..", "..", "docs", "permission-matrix.md"), "utf8");

function section(from: string, to: string): string {
  const start = doc.indexOf(from);
  const end = doc.indexOf(to, start + 1);
  if (start < 0 || end < 0) throw new Error(`permission-matrix.md: cannot find ${from}`);
  return doc.slice(start, end);
}

const staff = parseMatrix(
  section("## 5. Permission matrix: staff roles", "## 6. Permission matrix"),
  "staff",
);
const others = parseMatrix(
  section("## 6. Permission matrix", "## 7. Status transitions"),
  "others",
);
const transitions = parseTransitions(section("## 7. Status transitions", "## 8. Automation"));

const output = { source: "docs/permission-matrix.md", staff, others, transitions };
writeFileSync(
  join(here, "..", "src", "generated", "matrix.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);

const provisional = staff.filter((row) => row.provisional).length;
const conditioned = [...staff, ...others].flatMap((row) =>
  Object.values(row.grants).flatMap((grants) => grants.filter((g) => g.conditions.length > 0)),
).length;
console.log(
  `policy: ${staff.length} staff rows (${provisional} provisional names, reports included), ` +
    `${others.length} client/guest/demo rows, ${conditioned} conditioned grants, ` +
    `${transitions.length} transition rules -> src/generated/matrix.json`,
);
