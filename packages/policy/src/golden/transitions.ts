import { expect } from "vitest";

import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, member } from "../authz/fixtures";
import type { PolicyPrincipal } from "../engine";
import type { Actor } from "../matrix";
import { STAFF_ROLE_CODES, type StaffRole } from "../roles";
import { STATUS_MACHINES, type ActorPrincipal } from "../statuses";
import { canTransition, type TransitionContext } from "../transitions";
import type { GoldenMover, GoldenTransition } from "./transitions-types";

/*
 * The §7 golden table's assertions: for every move a row covers, each listed mover moves it (an
 * "(a)" mover on its weddings only) and every other role does not; the client and the System as
 * the table says; the record's people as the principal types it gives them; and a qualified row
 * for its kind only. Expectations come from the table alone, never from matrix.json.
 */

const ACTORS: readonly Actor[] = ["assignee", "owner", "creator", "requester"];
const CLIENT: PolicyPrincipal = { type: "client", userId: ME, projectIds: [MEMBER_PROJECT] };
const PEOPLE: readonly (readonly [ActorPrincipal, PolicyPrincipal])[] = [
  ["staff", { type: "staff", userId: ME, roles: [], projectIds: [MEMBER_PROJECT] }],
  ["client", CLIENT],
  ["guest", { type: "guest", userId: ME, projectIds: [MEMBER_PROJECT] }],
  ["demo", { type: "demo", userId: ME, projectIds: [MEMBER_PROJECT] }],
];
const SYSTEM: PolicyPrincipal = { type: "system" };
const OUTSIDER: PolicyPrincipal = { type: "client", userId: ME, projectIds: [FOREIGN_PROJECT] };
const EVERYONE: PolicyPrincipal = { ...member("SA"), roles: STAFF_ROLE_CODES };

function moverOf(mover: GoldenMover): { readonly role: StaffRole; readonly assigned: boolean } {
  const role = STAFF_ROLE_CODES.find((code) => mover === code || mover === `${code} (a)`);
  if (role === undefined) throw new Error(`golden table: no mover "${mover}"`);
  return { role, assigned: mover !== role };
}

function statusesOf(entity: string): readonly string[] {
  return STATUS_MACHINES[entity]?.statuses ?? [];
}

/** "previous status" restores what a hold saved, and a terminal status is never put on hold. */
function restorable(entity: string): readonly string[] {
  const terminal = STATUS_MACHINES[entity]?.terminal ?? [];
  return statusesOf(entity).filter((status) => !terminal.includes(status));
}

function covers(row: GoldenTransition, from: string, to: string, kind?: string): boolean {
  const reaches = row.to === "previous" ? restorable(row.entity).includes(to) : row.to.includes(to);
  return row.from.includes(from) && reaches && (row.kind === undefined || row.kind === kind);
}

function withActor(context: TransitionContext, actor: Actor, id: string): TransitionContext {
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

interface Move {
  readonly row: GoldenTransition;
  readonly from: string;
  readonly to: string;
  readonly context: TransitionContext;
  /** The rows of the table that cover the same move for the same kind. */
  readonly same: readonly GoldenTransition[];
}

function expectStaff({ row, from, to, context, same }: Move): void {
  const movers = same.flatMap((other) => (other.movers ?? []).map(moverOf));
  const anywhere = new Set(movers.filter((m) => !m.assigned).map((m) => m.role));
  for (const { role, assigned } of (row.movers ?? []).map(moverOf)) {
    expect(canTransition(member(role), row.entity, from, to, context), role).not.toBeNull();
    if (!assigned || anywhere.has(role)) continue;
    const outside = { ...context, projectId: FOREIGN_PROJECT };
    expect(
      canTransition(member(role), row.entity, from, to, outside),
      `${role} outside`,
    ).toBeNull();
  }
  const listed = new Set(movers.map((m) => m.role));
  for (const role of STAFF_ROLE_CODES.filter((code) => !listed.has(code))) {
    expect(canTransition(member(role), row.entity, from, to, context), role).toBeNull();
  }
}

function expectOthers({ row, from, to, context, same }: Move): void {
  const client = same.some((other) => other.client === true);
  const system = same.some((other) => other.system === true);
  const moves = (principal: PolicyPrincipal) =>
    canTransition(principal, row.entity, from, to, context) !== null;
  expect(moves(CLIENT), "client").toBe(client);
  expect(moves(OUTSIDER), "another wedding's client").toBe(false);
  expect(moves(SYSTEM), "system").toBe(system);
}

function expectPeople({ row, from, to, context, same }: Move): void {
  const clientElsewhere = same.some((other) => other.client === true);
  for (const actor of ACTORS) {
    // Only a person some row of the move names, as a type it gives them, moves the record so.
    const types = same.flatMap((other) => other.actors?.[actor] ?? []);
    for (const [type, principal] of PEOPLE) {
      if (type === "client" && clientElsewhere) continue;
      const mine = canTransition(principal, row.entity, from, to, withActor(context, actor, ME));
      expect(mine !== null, `${actor} as ${type}`).toBe(types.includes(type));
      const theirs = withActor(context, actor, SOMEONE);
      expect(canTransition(principal, row.entity, from, to, theirs), type).toBeNull();
    }
  }
}

function expectKind({ row, from, to, context }: Move, rows: readonly GoldenTransition[]): void {
  if (row.kind === undefined) return;
  const otherKind = { ...context, kind: "another_kind" };
  const plain = rows.filter((other) => other.entity === row.entity && covers(other, from, to));
  if (plain.length > 0) return;
  for (const { role } of (row.movers ?? []).map(moverOf)) {
    expect(canTransition(member(role), row.entity, from, to, otherKind), role).toBeNull();
  }
  for (const actor of ACTORS.filter((name) => row.actors?.[name] !== undefined)) {
    const asActor = withActor(otherKind, actor, ME);
    for (const [, principal] of PEOPLE) {
      expect(canTransition(principal, row.entity, from, to, asActor)).toBeNull();
    }
  }
}

/**
 * Asserts every move one row covers: each From to each To but itself, "previous" to every non-terminal status.
 *
 * @example
 * it("§7 line 422", () => expectRowMoves(row, TRANSITION_ROWS));
 */
export function expectRowMoves(row: GoldenTransition, rows: readonly GoldenTransition[]): void {
  const targets = row.to === "previous" ? restorable(row.entity) : row.to;
  for (const from of row.from) {
    for (const to of targets.filter((status) => status !== from)) {
      const context: TransitionContext = {
        projectId: MEMBER_PROJECT,
        kind: row.kind,
        previousStatus: row.to === "previous" ? to : undefined,
      };
      const same = rows.filter(
        (other) => other.entity === row.entity && covers(other, from, to, row.kind),
      );
      const move = { row, from, to, context, same };
      expectStaff(move);
      expectOthers(move);
      expectPeople(move);
      expectKind(move, rows);
    }
  }
}

/**
 * Asserts that no principal makes a move of the entity that no row covers, for any record kind.
 *
 * @example
 * it("incident: nothing else", () => expectNoOtherMoves("incident", TRANSITION_ROWS));
 */
export function expectNoOtherMoves(entity: string, rows: readonly GoldenTransition[]): void {
  const statuses = statusesOf(entity);
  const kinds = [undefined, "another_kind", ...Object.values(STATUS_MACHINES[entity]?.kinds ?? {})];
  for (const from of statuses) {
    for (const to of statuses.filter((status) => status !== from)) {
      for (const kind of kinds) {
        if (rows.some((row) => row.entity === entity && covers(row, from, to, kind))) continue;
        const everyone = ACTORS.reduce<TransitionContext>(
          (context, actor) => withActor(context, actor, ME),
          { projectId: MEMBER_PROJECT, previousStatus: to, kind },
        );
        for (const principal of [EVERYONE, SYSTEM, ...PEOPLE.map(([, person]) => person)]) {
          expect(
            canTransition(principal, entity, from, to, everyone),
            `${from} → ${to}`,
          ).toBeNull();
        }
      }
    }
  }
}
