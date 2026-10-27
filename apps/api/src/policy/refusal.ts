import { type AppError, errors } from "@ampm/core";
import { decideBeforeRead, readKeyFor, type PolicyPrincipal } from "@ampm/policy";

/**
 * May the principal read the records the key acts on? A read that reaches only its own records
 * ("(o)") shows none before one is read, so it counts only once the record's owner is known.
 */
function canSee(
  principal: PolicyPrincipal,
  key: string,
  projectId: string | undefined,
  ownerId: string | undefined,
): boolean {
  const readKey = readKeyFor(key);
  if (readKey === null) return false;
  const read = decideBeforeRead(principal, readKey, { projectId, ownerId });
  return read.allowed && (ownerId !== undefined || read.scope !== "own");
}

/**
 * The refusal of a key the principal does not hold (test-cases.md line 212): a 403 when it may see
 * the records the key acts on, otherwise the 404 of a missing record (architecture §6, denial
 * equals absence). One that sees only its own records ("(o)") gets the 404 while the record is
 * unread, as at PermissionGuard: nothing tells yet that it is theirs. A service that has read the
 * record passes its owner, so a refused action on the principal's own record is the 403 AC-12.1
 * asks for on a visible record (test-cases.md line 854), and on anyone else's the 404.
 *
 * @example
 * if (!decide(principal, "tasks.incidents.update", { projectId }).allowed) {
 *   throw refusalFor(principal, "tasks.incidents.update", projectId);
 * }
 * // Once the task is read, its owner decides whether the principal could see it:
 * throw refusalFor(principal, "tasks.tasks.delete", task.projectId, task.ownerUserId);
 */
export function refusalFor(
  principal: PolicyPrincipal,
  key: string,
  projectId: string | undefined,
  ownerId?: string,
): AppError {
  return canSee(principal, key, projectId, ownerId) ? errors.forbidden() : errors.notFound();
}
