import type { PolicyPrincipal } from "./engine";
import { MATRIX, type Actor, type Transition } from "./matrix";
import { STATUS_MACHINES, type StatusMachine } from "./statuses";

/**
 * What the service knows about the record a principal wants to move (permission-matrix §7). A
 * client, guest or demo principal moves a record only on its own wedding or account (§1 line 52,
 * §6 line 338), so the service passes the record's projectId, or its accountId when the record
 * belongs to an account before any wedding (a hotel enquiry); without either they move nothing.
 *
 * @example
 * const context: TransitionContext = { projectId: incident.projectId, assigneeId: incident.assignedUserId };
 */
export interface TransitionContext {
  /** The record's wedding: an assigned mover, "PM (a)", or a client must be a member of it. */
  readonly projectId?: string | undefined;
  /** The record's client account, for a record that has no wedding yet (§7 line 400); ignored once projectId is set. */
  readonly accountId?: string | undefined;
  /** The record's people, compared with the principal's userId for "The assignee" and the rest. */
  readonly assigneeId?: string | undefined;
  readonly ownerId?: string | undefined;
  readonly creatorId?: string | undefined;
  readonly requesterId?: string | undefined;
  /** The status saved when the record was put on hold, for "on_hold → previous status". */
  readonly previousStatus?: string | undefined;
  /** The record's kind, for rows limited to one ("answered (question)": the request type). */
  readonly kind?: string | undefined;
}

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

function reaches(
  rule: Transition,
  machine: StatusMachine,
  from: string,
  to: string,
  context: TransitionContext,
): boolean {
  if (!rule.from.includes(from)) return false;
  if (rule.kind !== null && rule.kind !== context.kind) return false;
  if (!rule.restore) return rule.to.includes(to);
  // A terminal status is never put on hold, so a saved one is bad data and must not skip the row
  // that reaches it ("closure → closed" needs the checklist and FA's approval, §7 line 420).
  return context.previousStatus === to && !machine.terminal.includes(to);
}

/**
 * The principal is one of the record's people the rule names, and of a type the record allows for
 * that person (statuses.ts): a user id alone never makes a client a task's owner.
 */
function isActor(
  rule: Transition,
  machine: StatusMachine,
  principal: PolicyPrincipal,
  context: TransitionContext,
): boolean {
  const { type, userId } = principal;
  if (userId === undefined || type === "system") return false;
  return rule.actors.some(
    (actor) => machine.actors[actor]?.includes(type) === true && actorId(context, actor) === userId,
  );
}

function isMember(principal: PolicyPrincipal, context: TransitionContext): boolean {
  return (
    context.projectId !== undefined && principal.projectIds?.includes(context.projectId) === true
  );
}

/**
 * §1 line 52: a client, guest or demo principal reaches only its own wedding or account. A record
 * on a wedding is decided by membership alone; the account counts only before there is a wedding.
 */
function ownsRecord(principal: PolicyPrincipal, context: TransitionContext): boolean {
  const { projectId, accountId } = context;
  if (projectId !== undefined) return isMember(principal, context);
  return accountId !== undefined && principal.accountIds?.includes(accountId) === true;
}

function moves(
  rule: Transition,
  machine: StatusMachine,
  principal: PolicyPrincipal,
  context: TransitionContext,
): boolean {
  if (principal.type === "system") return rule.system;
  if (principal.type === "staff") {
    const byRole = rule.roles.some(
      (mover) =>
        principal.roles?.includes(mover.role) && (!mover.assigned || isMember(principal, context)),
    );
    return byRole || isActor(rule, machine, principal, context);
  }
  if (!ownsRecord(principal, context)) return false;
  // "Either CR" is a client's; guests and the demo move a record only as one of its people.
  return isActor(rule, machine, principal, context) || (principal.type === "client" && rule.client);
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
      reaches(candidate, machine, from, to, context) &&
      moves(candidate, machine, principal, context),
  );
  return rule ?? null;
}
