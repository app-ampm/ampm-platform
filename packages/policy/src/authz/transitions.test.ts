/**
 * The generated transition suite (test-cases.md AC-31.1, permission-matrix §7): for every rule and
 * every move it covers, each listed mover may make it and every other role may not; an assigned
 * mover needs the membership, a qualified or exception rule its kind or exception; and no principal
 * makes a move that no rule lists.
 */
import { describe, expect, it } from "vitest";

import type { PolicyPrincipal } from "../engine";
import { MATRIX, type Actor, type Transition } from "../matrix";
import { STAFF_ROLE_CODES, type StaffRole } from "../roles";
import { STATUS_MACHINES } from "../statuses";
import { canTransition, type TransitionContext } from "../transitions";
import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, member } from "./fixtures";

const client: PolicyPrincipal = { type: "client", userId: ME, projectIds: [MEMBER_PROJECT] };
const system: PolicyPrincipal = { type: "system" };
const nobody: PolicyPrincipal = {
  type: "staff",
  userId: ME,
  roles: [],
  projectIds: [MEMBER_PROJECT],
};

function statusesOf(entity: string): readonly string[] {
  return STATUS_MACHINES[entity]?.statuses ?? [];
}

/** The moves a rule covers; staying in a status is no move ("derived" lists every readiness state). */
function movesOf(rule: Transition): [string, string][] {
  const targets = rule.restore ? statusesOf(rule.entity) : rule.to;
  return rule.from.flatMap((from) =>
    targets.filter((to) => to !== from).map((to): [string, string] => [from, to]),
  );
}

function contextFor(rule: Transition, to: string): TransitionContext {
  return {
    projectId: MEMBER_PROJECT,
    kind: rule.kind ?? undefined,
    exception: rule.exception ? true : undefined,
    previousStatus: rule.restore ? to : undefined,
  };
}

function asActor(actor: Actor, id: string, context: TransitionContext): TransitionContext {
  switch (actor) {
    case "assignee":
      return { ...context, assigneeId: id };
    case "owner":
      return { ...context, ownerId: id };
    case "creator":
      return { ...context, creatorId: id };
    case "requester":
      return { ...context, requesterId: id };
  }
}

/** Every rule that the same move, with the same context, reaches. */
function rulesFor(rule: Transition, from: string, to: string): Transition[] {
  return MATRIX.transitions.filter(
    (other) =>
      other.entity === rule.entity &&
      other.from.includes(from) &&
      (other.restore ? rule.restore : other.to.includes(to)) &&
      (other.kind === null || other.kind === rule.kind) &&
      (!other.exception || rule.exception),
  );
}

function expectMovers(rule: Transition, from: string, to: string): void {
  const context = contextFor(rule, to);
  const same = rulesFor(rule, from, to);
  const listed = new Set<StaffRole>(same.flatMap((r) => r.roles.map((m) => m.role)));
  const anywhere = new Set(
    same.flatMap((r) => r.roles.filter((m) => !m.assigned).map((m) => m.role)),
  );
  for (const mover of rule.roles) {
    expect(
      canTransition(member(mover.role), rule.entity, from, to, context),
      mover.role,
    ).not.toBeNull();
    if (mover.assigned && !anywhere.has(mover.role)) {
      const outside = { ...context, projectId: FOREIGN_PROJECT };
      expect(canTransition(member(mover.role), rule.entity, from, to, outside)).toBeNull();
    }
  }
  for (const role of STAFF_ROLE_CODES.filter((code) => !listed.has(code))) {
    expect(canTransition(member(role), rule.entity, from, to, context), role).toBeNull();
  }
  const expectClient = rule.client ? "not.null" : same.some((r) => r.client) ? "any" : "null";
  if (expectClient !== "any") {
    const moved = canTransition(client, rule.entity, from, to, context);
    expect(moved === null ? "null" : "not.null", "client").toBe(expectClient);
  }
  const systemMoves = same.some((r) => r.system);
  expect(canTransition(system, rule.entity, from, to, context) !== null, "system").toBe(
    systemMoves,
  );
}

function expectActors(rule: Transition, from: string, to: string): void {
  const context = contextFor(rule, to);
  for (const actor of rule.actors) {
    expect(
      canTransition(nobody, rule.entity, from, to, asActor(actor, ME, context)),
    ).not.toBeNull();
    expect(
      canTransition(nobody, rule.entity, from, to, asActor(actor, SOMEONE, context)),
    ).toBeNull();
    if (actor === "requester" || actor === "owner") {
      expect(
        canTransition(client, rule.entity, from, to, asActor(actor, ME, context)),
      ).not.toBeNull();
    }
  }
}

function expectNarrowing(rule: Transition, from: string, to: string): void {
  const context = contextFor(rule, to);
  const plain = MATRIX.transitions.filter(
    (other) =>
      other.entity === rule.entity &&
      other.from.includes(from) &&
      other.to.includes(to) &&
      other.kind === null &&
      !other.exception,
  );
  for (const mover of rule.roles) {
    if (plain.some((other) => other.roles.some((m) => m.role === mover.role))) continue;
    if (rule.kind !== null) {
      const otherKind = { ...context, kind: "another_kind" };
      expect(canTransition(member(mover.role), rule.entity, from, to, otherKind)).toBeNull();
    }
    if (rule.exception) {
      const plainMove = { ...context, exception: undefined };
      expect(canTransition(member(mover.role), rule.entity, from, to, plainMove)).toBeNull();
    }
  }
}

describe("generated transition suite: §7", () => {
  it("covers every §7 row", () => {
    expect(MATRIX.transitions.length).toBeGreaterThanOrEqual(59);
  });

  for (const rule of MATRIX.transitions) {
    for (const [from, to] of movesOf(rule)) {
      it(`${rule.entity}: ${from} → ${to} by "${rule.who}"`, () => {
        expectMovers(rule, from, to);
        expectActors(rule, from, to);
        expectNarrowing(rule, from, to);
      });
    }
  }

  const everyone: PolicyPrincipal = { ...member("SA"), roles: STAFF_ROLE_CODES };
  for (const entity of Object.keys(STATUS_MACHINES)) {
    it(`${entity}: no principal makes a move no rule lists`, () => {
      const statuses = statusesOf(entity);
      for (const from of statuses) {
        for (const to of statuses.filter((status) => status !== from)) {
          const listed = MATRIX.transitions.some(
            (r) => r.entity === entity && r.from.includes(from) && (r.restore || r.to.includes(to)),
          );
          if (listed) continue;
          const context: TransitionContext = {
            projectId: MEMBER_PROJECT,
            assigneeId: ME,
            ownerId: ME,
            creatorId: ME,
            requesterId: ME,
            exception: true,
          };
          for (const principal of [everyone, client, system]) {
            expect(
              canTransition(principal, entity, from, to, context),
              `${from} → ${to}`,
            ).toBeNull();
          }
        }
      }
    });
  }
});
