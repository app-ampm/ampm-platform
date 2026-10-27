/**
 * The §4 golden table (src/golden/classes.ts) against staffReadableClasses(): for every class and
 * every staff role, each context the table names must open the class exactly when the table says
 * so. The table must hold every class of §4, on the line the document gives it.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { VISIBILITY_CLASSES } from "./classes";
import { CLASS_GOLDEN } from "./golden/classes";
import { STAFF_ROLE_CODES } from "./roles";
import { staffReadableClasses } from "./visibility";

describe("§4 golden table: the classes staff roles are shown", () => {
  it("holds every class of §4, on the line the document gives it", () => {
    const document = documentTableRows("## 4. Field visibility classes", "## 5. Permission matrix");
    expect(CLASS_GOLDEN.map((golden) => [golden.line, golden.cls])).toEqual(
      document.map((row) => [row.line, row.cells[0]]),
    );
    expect(CLASS_GOLDEN.map((golden) => golden.cls)).toEqual(VISIBILITY_CLASSES);
  });

  for (const golden of CLASS_GOLDEN) {
    for (const role of STAFF_ROLE_CODES) {
      const opens = golden.opens[role] ?? [];
      it(`§4 line ${golden.line}: ${golden.cls} for ${role} opens in ${opens.join(", ") || "no context"} only`, () => {
        const names = Object.keys(golden.contexts);
        for (const name of opens) expect(names, "a context of the golden table").toContain(name);
        for (const [name, context] of Object.entries(golden.contexts)) {
          const shown = staffReadableClasses([role], context).has(golden.cls);
          expect(shown, `${role} ${name} ${JSON.stringify(context)}`).toBe(opens.includes(name));
        }
      });
    }
  }
});
