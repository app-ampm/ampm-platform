import { admittedVisibilities, type RecordVisibility, type Scope } from "@ampm/policy";

import type { Principal } from "../policy/principal.types.js";

/**
 * Step 5 of the pipeline (architecture §6): the filters every query on a project-owned table
 * carries, built from the principal and the scope PermissionGuard resolved from the matrix.
 * Repositories spread `where` into theirs and map the rest to their own columns; no query bypasses
 * them (security.md).
 */
export interface RecordScope {
  /** Project membership and soft delete, as Prisma `where` fields of every project-owned table. */
  readonly where: { readonly projectId?: { readonly in: string[] }; readonly deletedAt: null };
  /** Demo isolation (A-28): the value the table's `is_demo` must hold; absent for the system. */
  readonly isDemo?: boolean;
  /** Own scope ("(o)"): the user the table's owner or creator column must name. */
  readonly ownerId?: string;
  /** Record visibility (§1 layer 5): the admitted values of a `visibility` column; absent for all. */
  readonly visibilities?: readonly RecordVisibility[];
}

const LIVE = { deletedAt: null } as const;

/**
 * The scope of one request. Staff reach what their grant's scope reaches: every wedding, their
 * weddings, or their own records. Clients and the demo reach their own weddings only (§6 line 338),
 * through the visibilities addressed to them.
 *
 * @example
 * const scope = recordScope(principal, access.scope);
 * prisma.task.findMany({ where: { ...scope.where, isDemo: scope.isDemo, ownerUserId: scope.ownerId } });
 */
export function recordScope(principal: Principal, scope: Scope): RecordScope {
  if (principal.type === "system") return { where: LIVE };
  const memberOf = { projectId: { in: principal.memberships.map((m) => m.projectId) }, ...LIVE };
  if (principal.type === "staff") {
    if (scope === "assigned") return { where: memberOf, isDemo: false };
    if (scope === "own") return { where: LIVE, isDemo: false, ownerId: principal.userId };
    return { where: LIVE, isDemo: false };
  }
  const visibilities = admittedVisibilities(principal.type) ?? [];
  return { where: memberOf, isDemo: principal.type === "demo", visibilities };
}

/** A record as the scope sees it, for stores that are not Prisma (the spike's map) and for tests. */
export interface ScopedRecord {
  readonly projectId: string;
  readonly ownerId?: string | undefined;
  readonly isDemo?: boolean | undefined;
  readonly visibility?: RecordVisibility | undefined;
  readonly deletedAt?: Date | null | undefined;
}

/**
 * Whether a record lies inside the scope: the in-memory twin of the `where` a repository builds.
 *
 * @example
 * const items = [...store.values()].filter((record) => isInScope(record, scope));
 */
export function isInScope(record: ScopedRecord, scope: RecordScope): boolean {
  const { projectId } = scope.where;
  return (
    (record.deletedAt ?? null) === null &&
    (projectId === undefined || projectId.in.includes(record.projectId)) &&
    (scope.isDemo === undefined || (record.isDemo ?? false) === scope.isDemo) &&
    (scope.ownerId === undefined || record.ownerId === scope.ownerId) &&
    (scope.visibilities === undefined ||
      (record.visibility !== undefined && scope.visibilities.includes(record.visibility)))
  );
}
