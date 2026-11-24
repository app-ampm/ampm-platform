/**
 * Golden table of the §10 permission keys (docs/permission-matrix.md lines 560-575), written by
 * hand from the document: every key as §10 spells it resolves to its §5 row, and exactly the roles
 * the §5 cells grant hold it. Where §10's holder list differs from §5, the comment says so.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { DOCUMENT_RESOURCES, documentResource } from "./document-keys";
import { decide, readKeyFor, type PolicyPrincipal, type PolicyTarget } from "./engine";
import { STAFF_ROLE_CODES, type StaffRole } from "./roles";

interface Golden {
  readonly line: number;
  readonly key: string;
  /** The roles the key allows, each alone and a member of the wedding under test. */
  readonly allowed: readonly StaffRole[];
  /** What the caller knows about the target, for a conditioned cell. */
  readonly facts?: PolicyTarget;
  /** Every principal holds an explicit grant of the key on the wedding (P-5). */
  readonly grant?: true;
}

const GOLDEN: readonly Golden[] = [
  { line: 560, key: "hotels.profiles.update", allowed: ["SA", "HT"] },
  { line: 561, key: "hotels.rate_cards.read", allowed: ["SA", "SM", "HT", "PM", "FA"] },
  { line: 562, key: "hotels.contacts.read", allowed: ["SA", "SM", "HT", "PM", "HL"] },
  { line: 563, key: "consultancy.proposals.share", allowed: ["SA", "HT", "PM"] },
  {
    line: 564,
    key: "consultancy.proposals.read_internal_amount",
    allowed: ["SA", "HT", "PM", "FA"],
  },
  // §10 names PM for the scoped key; SA holds the unscoped one (§5.5 line 201).
  { line: 565, key: "projects.members.update:assigned", allowed: ["SA", "PM"] },
  // The scope suffix does not change the row: lines 566 and 567 decide alike (§5.7 line 221; HT
  // and VC hold it for their side's lines only).
  { line: 566, key: "budget.lines.read_internal_cost:assigned", allowed: ["SA", "PM", "FA"] },
  { line: 567, key: "budget.lines.read_internal_cost", allowed: ["SA", "PM", "FA"] },
  // §5.7 line 223 also gives PM "R (a)", which §10's holder list leaves out.
  { line: 568, key: "vendors.quotes.read", allowed: ["SA", "PM", "VC", "FA"] },
  { line: 569, key: "approvals.decisions.create_on_behalf:assigned", allowed: ["SA", "PM"] },
  {
    line: 570,
    key: "guests.identity_documents.read:assigned",
    allowed: ["RG", "HL"],
    facts: { checks: ["check_in"] },
    grant: true,
  },
  {
    line: 571,
    key: "guests.identity_documents.read",
    allowed: ["SA"],
    facts: { checks: ["break_glass"] },
  },
  { line: 572, key: "guests.sensitive.read:assigned", allowed: ["SA", "PM", "RG", "HL"] },
  // §10 still names PM; §5.6 line 212 (Q10) leaves the authorisation to SA alone (AC-13.2).
  { line: 573, key: "functions.readiness.authorise_exception:assigned", allowed: ["SA"] },
  {
    line: 574,
    key: "projects.close:assigned",
    allowed: ["SA", "PM"],
    facts: { checks: ["closure_ready"] },
  },
  { line: 575, key: "reports.budget_internal.export", allowed: ["SA", "FA"] },
];

function member(role: StaffRole, golden: Golden): PolicyPrincipal {
  const explicitGrants = golden.grant ? [{ key: golden.key, projectId: "p-1" }] : [];
  return { type: "staff", userId: `u-${role}`, roles: [role], projectIds: ["p-1"], explicitGrants };
}

function allowedRoles(golden: Golden): StaffRole[] {
  const target = { ...golden.facts, projectId: "p-1" };
  return STAFF_ROLE_CODES.filter(
    (role) => decide(member(role, golden), golden.key, target).allowed,
  );
}

describe("§10 permission keys as the document spells them", () => {
  it("§10 lines 560-575: the golden table has every key of the document, in order", () => {
    const document = documentTableRows("## 10.", "## 11.");
    expect(GOLDEN.map((golden) => [golden.line, `\`${golden.key}\``])).toEqual(
      document.map((row) => [row.line, row.cells[0]]),
    );
  });

  it.each(GOLDEN)("§10 line $line: $key resolves to its row", (golden) => {
    expect(readKeyFor(golden.key)).not.toBeNull();
  });

  it.each(GOLDEN)("§10 line $line: $key allows exactly its §5 holders", (golden) => {
    expect(allowedRoles(golden)).toEqual(
      STAFF_ROLE_CODES.filter((r) => golden.allowed.includes(r)),
    );
  });

  it("every §10 resource name names a row of its own module", () => {
    for (const name of Object.keys(DOCUMENT_RESOURCES)) {
      const [module = "", resource = ""] = name.split(".");
      expect(documentResource(module, resource), name).not.toBe(resource);
    }
  });
});
