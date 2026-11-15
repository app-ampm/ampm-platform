import type { AccountContactUpdateRequest, AccountUpdateRequest } from "@ampm/core";

import type { AccountContactPatch, AccountPatch } from "./accounts.repository.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** The account patch an edit asks for: only the keys it names (an absent key is not a change). */
export function accountPatchOf(request: AccountUpdateRequest): AccountPatch {
  const patch: Mutable<AccountPatch> = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.coupleNames !== undefined) patch.coupleNames = request.coupleNames;
  if (request.preferredLocations !== undefined) {
    patch.preferredLocations = request.preferredLocations;
  }
  if (request.internalNotes !== undefined) patch.internalNotes = request.internalNotes;
  return patch;
}

/** The contact patch an edit asks for: only the keys it names. */
export function contactPatchOf(request: AccountContactUpdateRequest): AccountContactPatch {
  const patch: Mutable<AccountContactPatch> = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.relation !== undefined) patch.relation = request.relation;
  if (request.email !== undefined) patch.email = request.email;
  if (request.phone !== undefined) patch.phone = request.phone;
  if (request.isDecisionMaker !== undefined) patch.isDecisionMaker = request.isDecisionMaker;
  return patch;
}

/**
 * The audit's before image for a patch: each patched key's value as it stood, so the audit row holds
 * exactly the fields that changed, before and after (security.md "Audit").
 *
 * @example
 * audit.record({ action: "update", ..., before: beforeImage(current, patch), after: patch });
 */
export function beforeImage(current: object, patch: object): Record<string, unknown> {
  const values = new Map<string, unknown>(Object.entries(current));
  return Object.fromEntries(Object.keys(patch).map((key) => [key, values.get(key) ?? null]));
}
