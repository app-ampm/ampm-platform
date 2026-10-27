/**
 * The §7 golden table (src/golden/transitions-rows-*.ts) against the document and canTransition().
 * The table must hold exactly the rows of §7 the document's text has, each on its line and under
 * its heading; then every move of every row is asserted for each staff role, the client, the
 * System and the record's people, and every move no row lists is refused to everyone
 * (src/golden/transitions.ts). The generated suite in src/authz is a second check, not the only one.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { expectNoOtherMoves, expectRowMoves } from "./golden/transitions";
import { TRANSITIONS_389_TO_429 } from "./golden/transitions-rows-a";
import { TRANSITIONS_434_TO_483 } from "./golden/transitions-rows-b";
import { STATUS_MACHINES } from "./statuses";

const ROWS = [...TRANSITIONS_389_TO_429, ...TRANSITIONS_434_TO_483];

describe("§7 golden table: status transitions", () => {
  it("holds every row of §7, on the line and under the heading the document gives it", () => {
    const document = documentTableRows("## 7. Status transitions", "## 8. Automation");
    expect(ROWS.map((row) => [row.line, STATUS_MACHINES[row.entity]?.heading])).toEqual(
      document.map((row) => [row.line, row.heading]),
    );
    expect(ROWS).toHaveLength(59);
  });

  for (const row of ROWS) {
    it(`§7 line ${row.line}: ${row.entity} ${row.from.join(", ")} → ${String(row.to)}`, () => {
      expectRowMoves(row, ROWS);
    });
  }

  for (const entity of Object.keys(STATUS_MACHINES)) {
    it(`${entity}: no principal makes a move that no row of §7 lists`, () => {
      expectNoOtherMoves(entity, ROWS);
    });
  }
});
