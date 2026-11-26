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

/*
 * The form's sections (D-190 §1): three new tables, two consent kinds and four event types, and the
 * consents' CHECK widened from "the notice has no revision hash" to "a declaration has one, the notice
 * none". Prisma applies the file one statement at a time, each committing on its own, so the new CHECK is
 * added before the old one is dropped and the table is never without one, and it names only
 * `privacy_notice`, never a value this file adds, so the file also runs by hand as one transaction
 * (PostgreSQL refuses a new enum value before its ALTER TYPE commits).
 */
describe("migration 20261201000000_hotel_form_sections", () => {
  const statements = statementsOf("20261201000000_hotel_form_sections");
  const addedValues = statements.flatMap((statement) => {
    const added = /^ALTER TYPE "\w+" ADD VALUE '([a-z_]+)'$/.exec(statement);
    return added?.[1] === undefined ? [] : [added[1]];
  });

  it("bounds every lock wait at 5 seconds from its first statement", () => {
    expect(statements[0]).toBe(LOCK_TIMEOUT);
  });

  it("adds the two declarations' consent kinds and the form's four event types, and no other value", () => {
    expect(addedValues).toEqual([
      "accuracy_attestation",
      "display_authorisation",
      "submitted",
      "correction_requested",
      "consent_withdrawn",
      "removal_requested",
    ]);
  });

  it("creates the sections, revisions and corrections, and touches no audit partition", () => {
    const created = statements.flatMap((statement) => {
      const table = /^CREATE TABLE "(\w+)"/.exec(statement);
      return table?.[1] === undefined ? [] : [table[1]];
    });
    expect(created).toEqual([
      "hotel_info_request_sections",
      "hotel_info_request_revisions",
      "hotel_info_request_corrections",
    ]);
    expect(placesNaming(statements, ["audit_events"])).toEqual([]);
  });

  it("widens the consents' CHECK without a moment unchecked, naming no value it adds", () => {
    const consents = placesNaming(statements, ["hotel_info_request_consents"]);
    const added = statements.findIndex((statement) =>
      statement.includes('ADD CONSTRAINT "hotel_info_request_consents_revision_hash_by_kind"'),
    );
    const dropped = statements.findIndex((statement) =>
      statement.includes('DROP CONSTRAINT "hotel_info_request_consents_notice_has_no_revision"'),
    );
    expect(consents).toEqual([added, dropped]);
    expect(added).toBeGreaterThan(0);
    expect(dropped).toBe(added + 1);
    const check = statements[added] ?? "";
    for (const value of addedValues) expect(check).not.toContain(`'${value}'`);
    expect(check).toContain("'privacy_notice'");
  });
});
