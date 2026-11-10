/**
 * The §5 golden tables (src/golden/staff-rows-*.ts) against the document and decide(). The tables
 * must hold exactly the rows of §5.1 to §5.15 that the document's text has, each on its line and
 * under its subsection; then every role of every row is asserted through decide(), inside and
 * outside its scope, with and without the facts its note needs (src/golden/staff.ts).
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { expectRow } from "./golden/staff";
import { STAFF_ROWS_5_1_TO_5_7 } from "./golden/staff-rows-a";
import { STAFF_ROWS_5_8_TO_5_10 } from "./golden/staff-rows-b";
import { STAFF_ROWS_5_11_TO_5_15 } from "./golden/staff-rows-c";
import { STAFF_ROLE_CODES } from "./roles";

const ROWS = [...STAFF_ROWS_5_1_TO_5_7, ...STAFF_ROWS_5_8_TO_5_10, ...STAFF_ROWS_5_11_TO_5_15];

describe("§5 golden tables: staff roles", () => {
  it("hold every row of §5.1 to §5.15, on the line and under the subsection the document gives it", () => {
    const document = documentTableRows("## 5. Permission matrix: staff roles", "### 5.16");
    expect(ROWS.map((golden) => [golden.line, golden.section, golden.label])).toEqual(
      document.map((row) => [row.line, row.heading.split(" ")[0], row.cells[0]]),
    );
    expect(ROWS).toHaveLength(106);
  });

  for (const golden of ROWS) {
    for (const role of STAFF_ROLE_CODES) {
      it(`§${golden.section} line ${golden.line}: ${role} on ${golden.label}`, () => {
        expectRow(golden, role);
      });
    }
  }
});
