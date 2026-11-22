import {
  coupleTitle,
  type AccountContactUpdateRequest,
  type AccountUpdateRequest,
} from "@ampm/core";

import type { AccountContactPatch, AccountPatch, AccountRow } from "./accounts.repository.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** The account patch an edit asks for: only the keys it names (an absent key is not a change). */
export function accountPatchOf(request: AccountUpdateRequest): AccountPatch {
  const patch: Mutable<AccountPatch> = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.coupleNames !== undefined) patch.coupleNames = request.coupleNames;
  if (request.brideName !== undefined) patch.brideName = request.brideName;
  if (request.brideFatherName !== undefined) patch.brideFatherName = request.brideFatherName;
  if (request.groomName !== undefined) patch.groomName = request.groomName;
  if (request.groomFatherName !== undefined) patch.groomFatherName = request.groomFatherName;
  if (request.preferredLocations !== undefined) {
    patch.preferredLocations = request.preferredLocations;
  }
  if (request.internalNotes !== undefined) patch.internalNotes = request.internalNotes;
  return patch;
}

type CoupleState = Pick<AccountRow, "name" | "coupleNames" | "brideName" | "groomName">;

/**
 * The couple names the client: when an edit changes the bride's or the groom's name and both are then
 * given, the account's name and couple names become "Bride & Groom", whatever else the edit sent for
 * them. An edit that leaves the couple incomplete clears a couple line that only followed the old couple
 * and keeps the name, which staff may then change. Keys whose value would not change are left out, so
 * the audit holds exactly what changed.
 *
 * @example
 * withCoupleNaming(current, { brideName: "Priya", groomName: "Arjun" });
 * // { brideName: "Priya", groomName: "Arjun", name: "Priya & Arjun", coupleNames: "Priya & Arjun" }
 */
export function withCoupleNaming(current: CoupleState, patch: AccountPatch): AccountPatch {
  if (patch.brideName === undefined && patch.groomName === undefined) return patch;
  const next = coupleTitle({
    brideName: patch.brideName === undefined ? current.brideName : patch.brideName,
    groomName: patch.groomName === undefined ? current.groomName : patch.groomName,
  });
  const naming: Mutable<AccountPatch> = { ...patch };
  if (next !== null) {
    naming.name = next;
    naming.coupleNames = next;
  } else if (current.coupleNames !== null && current.coupleNames === coupleTitle(current)) {
    naming.coupleNames = null;
  }
  if (naming.name === current.name) delete naming.name;
  if (naming.coupleNames === current.coupleNames) delete naming.coupleNames;
  return naming;
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
