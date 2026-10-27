import type { PolicyPrincipal } from "./engine";
import { MATRIX, type Actor, type Transition } from "./matrix";
import { STATUS_MACHINES } from "./statuses";

/**
 * What the service knows about the record a principal wants to move (permission-matrix §7).
 *
 * @example
 * const context: TransitionContext = { projectId: incident.projectId, assigneeId: incident.assignedUserId };
 */
export interface TransitionContext {
  /** The record's wedding: an assigned mover, "PM (a)", must be a member of it. */
  readonly projectId?: string | undefined;
  /** The record's people, compared with the principal's userId for "The assignee" and the rest. */
  readonly assigneeId?: string | undefined;
  readonly ownerId?: string | undefined;
  readonly creatorId?: string | undefined;
  readonly requesterId?: string | undefined;
  /** The status saved when the record was put on hold, for "on_hold → previous status". */
  readonly previousStatus?: string | undefined;
  /** The record's kind, for rows limited to one ("answered (question)": the request type). */
  readonly kind?: string | undefined;
  /** The move is the outcome of an exception authorised for the record (P-8, readiness). */
  readonly exception?: boolean | undefined;
}

/** The actors a client may be: the requester of a request, the owner of a record. */
const CLIENT_ACTORS: readonly Actor[] = ["requester", "owner"];
const STAFF_ACTORS: readonly Actor[] = ["assignee", "owner", "creator", "requester"];

function actorId(context: TransitionContext, actor: Actor): string | undefined {
  switch (actor) {
    case "assignee":
      return context.assigneeId;
    case "owner":
      return context.ownerId;
    case "creator":
      return context.creatorId;
    case "requester":
      return context.requesterId;
  }
}

function reaches(rule: Transition, from: string, to: string, context: TransitionContext): boolean {
  if (!rule.from.includes(from)) return false;
  if (rule.kind !== null && rule.kind !== context.kind) return false;
  if (rule.exception && context.exception !== true) return false;
  return rule.restore ? context.previousStatus === to : rule.to.includes(to);
}

function isActor(
  rule: Transition,
  principal: PolicyPrincipal,
  context: TransitionContext,
  allowed: readonly Actor[],
): boolean {
  const { userId } = principal;
  if (userId === undefined) return false;
  return rule.actors.some((actor) => allowed.includes(actor) && actorId(context, actor) === userId);
}

function moves(rule: Transition, principal: PolicyPrincipal, context: TransitionContext): boolean {
  if (principal.type === "system") return rule.system;
  if (principal.type === "client") {
    return rule.client || isActor(rule, principal, context, CLIENT_ACTORS);
  }
  // Demo and guest principals move nothing: §7 names neither.
  if (principal.type !== "staff") return false;
  const member =
    context.projectId !== undefined && principal.projectIds?.includes(context.projectId);
  const byRole = rule.roles.some(
    (mover) => principal.roles?.includes(mover.role) && (!mover.assigned || member),
  );
  return byRole || isActor(rule, principal, context, STAFF_ACTORS);
}

/**
 * Step 6 of the pipeline: may this principal move the record from one status to another (§7)?
 * Returns the rule that allows it, whose condition the service still checks, or null. A status the
 * entity does not have, or a move to the status the record already has, is never allowed.
 *
 * @example
 * canTransition(principal, "client_request", "under_review", "answered", {
 *   assigneeId: request.assignedUserId,
 *   kind: request.requestType,
 * });
 */
export function canTransition(
  principal: PolicyPrincipal,
  entity: string,
  from: string,
  to: string,
  context: TransitionContext = {},
): Transition | null {
  const machine = Object.hasOwn(STATUS_MACHINES, entity) ? STATUS_MACHINES[entity] : undefined;
  if (!machine || from === to) return null;
  if (!machine.statuses.includes(from) || !machine.statuses.includes(to)) return null;
  const rule = MATRIX.transitions.find(
    (candidate) =>
      candidate.entity === entity &&
      reaches(candidate, from, to, context) &&
      moves(candidate, principal, context),
  );
  return rule ?? null;
}
