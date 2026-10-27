/**
 * Golden cases for the §10 key vocabulary: the class-specific reads and the two verbs §10 names are
 * keys, and each resolves to the §5 row that holds that class or decision (values from
 * docs/permission-matrix.md, line in the test name).
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, member } from "./authz/fixtures";
import { decide, readKeyFor, type PolicyPrincipal, type PolicyTarget } from "./engine";
import { refusedVariants } from "./golden/facts";
import { KEY_ALIAS_GOLDEN, type AliasHolder } from "./golden/key-aliases";
import { parsePermissionKey } from "./keys";
import { KEY_ALIASES } from "./resources";
import { STAFF_ROLE_CODES, type Scope, type StaffRole } from "./roles";

function staff(roles: readonly StaffRole[], extra: Partial<PolicyPrincipal> = {}): PolicyPrincipal {
  return { type: "staff", userId: "u-1", roles, projectIds: ["p-1"], ...extra };
}

const IN_SCOPE: Readonly<Record<Scope, PolicyTarget>> = {
  all: {},
  assigned: { projectId: MEMBER_PROJECT, ownerId: SOMEONE },
  own: { projectId: FOREIGN_PROJECT, ownerId: ME },
};

/** An alias key decides as its row's cell says: allowed in scope with the facts, refused without. */
function expectAliasHolder(role: StaffRole, key: string, holder: AliasHolder | undefined): void {
  if (holder === undefined) {
    for (const target of Object.values(IN_SCOPE)) {
      expect(decide(member(role, key), key, target).reason, `${role} ${key}`).toBe("no_grant");
    }
    return;
  }
  const principal = holder.explicit === true ? member(role, key) : member(role);
  const facts = holder.facts ?? {};
  expect(decide(principal, key, { ...IN_SCOPE[holder.scope], ...facts }), `${role} ${key}`).toEqual(
    { allowed: true, scope: holder.scope, reason: "granted" },
  );
  if (holder.scope === "assigned") {
    const foreign = { projectId: FOREIGN_PROJECT, ownerId: SOMEONE, ...facts };
    expect(decide(principal, key, foreign).reason, `${role} ${key}`).toBe("not_assigned");
  }
  for (const fewer of refusedVariants(facts)) {
    const refused = decide(principal, key, { ...IN_SCOPE[holder.scope], ...fewer });
    expect(refused.allowed, `${role} ${key} ${JSON.stringify(fewer)}`).toBe(false);
  }
  if (holder.explicit === true) {
    expect(decide(member(role), key, IN_SCOPE[holder.scope]).allowed, `${role} ${key}`).toBe(false);
  }
}

describe("§10 permission keys", () => {
  it("§10 line 533: class-specific reads and the §10 verbs parse as keys", () => {
    expect(parsePermissionKey("budget.lines.read_internal_cost")).toEqual({
      module: "budget",
      resource: "lines",
      action: "read_internal_cost",
      scope: "all",
    });
    for (const action of [
      "read_internal_notes",
      "read_contacts",
      "read_sensitive",
      "read_identity",
      "read_internal_amount",
    ]) {
      expect(parsePermissionKey(`guests.guests.${action}:assigned`)?.action).toBe(action);
    }
    expect(parsePermissionKey("functions.readiness.authorise_exception:assigned")).toMatchObject({
      action: "authorise_exception",
      scope: "assigned",
    });
    expect(parsePermissionKey("approvals.decisions.create_on_behalf:assigned")?.action).toBe(
      "create_on_behalf",
    );
    expect(parsePermissionKey("budget.lines.read_everything")).toBeNull();
  });

  // §10 spells this key `budget.lines.read_internal_cost`; that spelling waits for the row's
  // curation (below), so this checks §10 lines 543-544's holders on the row's spelling.
  it("§5.7 line 216 with §10 lines 543-544's holders: budget.budget_lines_client_facing.read_internal_cost reads the internal-cost row", () => {
    const key = "budget.budget_lines_client_facing.read_internal_cost";
    expect(decide(staff(["FA"]), key)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["PM"]), key, { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["CD"]), key, { projectId: "p-1" }).reason).toBe("no_grant");
    expect(decide(staff(["HT"]), key).reason).toBe("condition_unmet");
  });

  it("§10 line 547, §5.10 line 264: read_identity on guests needs RG's explicit grant", () => {
    const key = "guests.family_groups_guests_standard.read_identity";
    expect(decide(staff(["RG"]), key, { projectId: "p-1" }).reason).toBe("condition_unmet");
    const explicitGrants = [{ key: "guests.identity_documents.read", projectId: "p-1" }];
    expect(decide(staff(["RG"], { explicitGrants }), key, { projectId: "p-1" }).allowed).toBe(true);
  });

  it("§10 line 545, §5.7 line 218: vendors.quotes.read reads the vendor quotes row of §5.7 (budget)", () => {
    const key = "vendors.quotes.read";
    for (const role of ["VC", "FA", "SA"] as const) {
      expect(decide(staff([role]), key), role).toMatchObject({ allowed: true, scope: "all" });
    }
    // §5.7 also gives PM "R (a)", which §10's holder list leaves out.
    expect(decide(staff(["PM"]), key, { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["CD"]), key, { projectId: "p-1" }).reason).toBe("no_grant");
  });

  it("§10 line 546, §5.9 line 252: approvals.decisions.create_on_behalf records a client decision (creative)", () => {
    const key = "approvals.decisions.create_on_behalf:assigned";
    expect(decide(staff(["PM"]), key, { projectId: "p-1" })).toMatchObject({
      allowed: true,
      scope: "assigned",
    });
    expect(decide(staff(["PM"]), key, { projectId: "p-2" }).reason).toBe("not_assigned");
    expect(decide(staff(["SA"]), key)).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["CD"]), key, { projectId: "p-1" }).reason).toBe("no_grant");
  });

  it("§10 line 551, §5.15 line 312: projects.close closes a project (closure), PM only when ready", () => {
    const key = "projects.close:assigned";
    expect(decide(staff(["PM"]), key, { projectId: "p-1" }).reason).toBe("condition_unmet");
    expect(
      decide(staff(["PM"]), key, { projectId: "p-1", checks: ["closure_ready"] }),
    ).toMatchObject({ allowed: true, scope: "assigned" });
    expect(decide(staff(["SA"]), "projects.close")).toMatchObject({ allowed: true, scope: "all" });
    expect(decide(staff(["FA"]), key, { checks: ["closure_ready"] }).reason).toBe("no_grant");
  });

  it("§10 lines 546 and 550, §5.9 line 252, §5.6 line 207: the §10 verbs name their rows' decisions", () => {
    const onBehalf = "creative.approval_decisions_on_client.create_on_behalf";
    expect(decide(staff(["PM"]), onBehalf, { projectId: "p-1" }).allowed).toBe(true);
    expect(decide(staff(["CD"]), onBehalf, { projectId: "p-1" }).reason).toBe("no_grant");
    const exception = "functions.readiness_exceptions.authorise_exception";
    expect(decide(staff(["SA"]), exception).allowed).toBe(true);
    expect(decide(staff(["PM"]), exception, { projectId: "p-1" }).reason).toBe("no_grant");
  });
});

/*
 * §10's example keys that name no row yet (§10 line, then the row they will name). Each resolves
 * once that row is curated under the key's spelling (resources.ts RESOURCES), or is listed in
 * OUTSIDE_KEYS or KEY_ALIASES; until then it decides no_grant for every role.
 */
const AWAITING_CURATION: readonly string[] = [
  "hotels.profiles.update", // 537, §5.3 line 168
  "hotels.rate_cards.read", // 538, §5.3 line 172
  "hotels.contacts.read", // 539, §5.3 line 170
  "consultancy.proposals.share", // 540, §5.4 line 185
  "consultancy.proposals.read_internal_amount", // 541, §5.4 line 186
  "projects.members.update:assigned", // 542, §5.5 line 196
  "budget.lines.read_internal_cost:assigned", // 543, §5.7 line 216
  "budget.lines.read_internal_cost", // 544, §5.7 line 216
  "guests.sensitive.read:assigned", // 549, §5.10 line 262
  "functions.readiness.authorise_exception:assigned", // 550, §5.6 line 207
];

describe("§10 lines 537-552: the example keys as §10 spells them", () => {
  const keys = documentTableRows("## 10. Permission keys", "## 11. Open questions").map((row) =>
    (row.cells[0] ?? "").replace(/`/g, ""),
  );

  it("each resolves to a §5 row, but for the spellings awaiting their row's curation", () => {
    expect(keys.filter((key) => readKeyFor(key) === null)).toEqual(AWAITING_CURATION);
  });

  it("a spelling awaiting curation decides no_grant for every role, the Super Admin included", () => {
    const everything = { projectId: "p-1", checks: ["break_glass", "closure_ready"] } as const;
    for (const key of AWAITING_CURATION) {
      for (const role of STAFF_ROLE_CODES) {
        expect(decide(staff([role]), key, everything).reason, `${role} ${key}`).toBe("no_grant");
      }
    }
  });
});

describe("§10 line 533: every alias key of resources.ts decides on its §5 row", () => {
  it("has a golden case for every KEY_ALIASES entry, and for nothing else", () => {
    const entries = Object.entries(KEY_ALIASES).flatMap(([section, labels]) =>
      Object.keys(labels).map((label) => `§${section} ${label}`),
    );
    const golden = KEY_ALIAS_GOLDEN.map((alias) => `§${alias.section} ${alias.label}`);
    expect([...golden].sort()).toEqual([...entries].sort());
  });

  for (const alias of KEY_ALIAS_GOLDEN) {
    it(`§${alias.section} line ${alias.line}: ${alias.key} holds as ${alias.label} does`, () => {
      for (const role of STAFF_ROLE_CODES) expectAliasHolder(role, alias.key, alias.holders[role]);
    });
  }
});
