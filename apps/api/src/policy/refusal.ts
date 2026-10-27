import { type AppError, errors } from "@ampm/core";
import { decideBeforeRead, readKeyFor, type PolicyPrincipal } from "@ampm/policy";

/**
 * May the principal read the records the key acts on? A read that reaches only its own records
 * ("(o)") shows none before one is read, so it does not count.
 */
function canSee(principal: PolicyPrincipal, key: string, projectId: string | undefined): boolean {
  const readKey = readKeyFor(key);
  if (readKey === null) return false;
  const read = decideBeforeRead(principal, readKey, { projectId });
  return read.allowed && read.scope !== "own";
}

/**
 * The refusal of a key the principal does not hold (test-cases.md line 212): a 403 when it may see
 * the records the key acts on, otherwise the 404 of a missing record (architecture §6, denial
 * equals absence). One that sees only its own records gets the 404: before the record is read,
 * nothing tells it is theirs. PermissionGuard and the services refuse through it alike.
 *
 * @example
 * if (!decide(principal, "tasks.incidents.update", { projectId }).allowed) {
 *   throw refusalFor(principal, "tasks.incidents.update", projectId);
 * }
 */
export function refusalFor(
  principal: PolicyPrincipal,
  key: string,
  projectId: string | undefined,
): AppError {
  return canSee(principal, key, projectId) ? errors.forbidden() : errors.notFound();
}
