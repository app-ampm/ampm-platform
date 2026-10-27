import type { Principal } from "../policy/principal.types.js";

/**
 * Step 5 of the pipeline (architecture §6): the filters every query on a project-owned table
 * carries, built once from the principal. Repositories spread these into their `where`; no query
 * bypasses them (security.md).
 */
export interface ProjectScope {
  readonly projectId?: { readonly in: readonly string[] } | undefined;
  readonly deletedAt: null;
}

export function projectScope(principal: Principal): ProjectScope {
  if (principal.type === "system") return { deletedAt: null };
  if (principal.type === "staff") {
    // Unassigned roles reach every project; the permission guard has already checked the key and scope.
    const assignedOnly = principal.roles.every((role) => ["PM", "CD", "RG", "HL"].includes(role));
    return assignedOnly
      ? { projectId: { in: principal.memberships.map((m) => m.projectId) }, deletedAt: null }
      : { deletedAt: null };
  }
  if (principal.type === "client" || principal.type === "demo") {
    return { projectId: { in: principal.memberships.map((m) => m.projectId) }, deletedAt: null };
  }
  return { projectId: { in: [] }, deletedAt: null };
}

/** Demo principals see demo data only; everyone else never sees it. */
export function demoScope(principal: Principal): { readonly isDemo: boolean } {
  return { isDemo: principal.type === "demo" };
}
