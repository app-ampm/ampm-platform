import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/*
 * The identity step's migrations (D-189 §1), applied while the previous API still serves. No statement waits
 * more than 5 seconds for a lock, so none keeps the API's writes queued behind it. The audit's statements,
 * which lock every audit partition, come last, in the order a live staff change takes its locks (a request,
 * its event, then its audit): a timeout there leaves only them to run by hand, and were the file run as one
 * transaction it could not deadlock with such a change. The audit's CHECK is added NOT VALID, reading no row
 * while the audit is locked, then validated by a statement of its own, which reads the rows while reads and
 * writes go on, so every partition, old or made later, ends with the same validated CHECK.
 */

const MIGRATIONS = new URL("../../../../prisma/migrations/", import.meta.url);

/** A migration's statements, its comments left out, each on one line without its semicolon. */
function statementsOf(migration: string): string[] {
  const sql = readFileSync(new URL(`${migration}/migration.sql`, MIGRATIONS), "utf8");
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement !== "");
}

/** The places of the statements that name any of these tables. */
function placesNaming(statements: readonly string[], tables: readonly string[]): number[] {
  return statements.flatMap((statement, place) =>
    tables.some((table) => statement.includes(`"${table}"`)) ? [place] : [],
  );
}

const LOCK_TIMEOUT = "SET lock_timeout = '5s'";

describe("migration 20261129000000_hotel_form_identity", () => {
  const statements = statementsOf("20261129000000_hotel_form_identity");

  it("bounds every lock wait at 5 seconds from its first statement", () => {
    expect(statements[0]).toBe(LOCK_TIMEOUT);
  });

  it("locks the audit last, after every request and event, as a live staff change does", () => {
    const audit = placesNaming(statements, ["audit_events"]);
    const live = placesNaming(statements, ["hotel_info_requests", "hotel_info_request_events"]);
    expect(live.length).toBeGreaterThan(0);
    const last = statements.length - 1;
    expect(audit).toEqual([last - 2, last - 1, last]);
    expect(Math.min(...audit)).toBeGreaterThan(Math.max(...live));
  });

  it("adds the audit's CHECK NOT VALID, then validates it in a statement of its own", () => {
    const check = statements.filter((statement) =>
      statement.includes('"audit_events_actor_ref_guest_only"'),
    );
    expect(check).toHaveLength(2);
    expect(check[0]).toMatch(/^ALTER TABLE "audit_events" ADD CONSTRAINT .* NOT VALID$/);
    expect(check[1]).toBe(
      'ALTER TABLE "audit_events" VALIDATE CONSTRAINT "audit_events_actor_ref_guest_only"',
    );
  });
});

describe("migration 20261130000000_hotel_form_events", () => {
  it("only adds enum values, which lock no table and read no row, with its lock waits bounded too", () => {
    const [first, ...rest] = statementsOf("20261130000000_hotel_form_events");
    expect(first).toBe(LOCK_TIMEOUT);
    expect(rest).toHaveLength(3);
    for (const statement of rest) {
      expect(statement).toMatch(/^ALTER TYPE "HotelInfoRequestEventType" ADD VALUE '[a-z_]+'$/);
    }
  });
});
