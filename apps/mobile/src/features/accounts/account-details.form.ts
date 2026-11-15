import {
  accountUpdateRequest,
  type AccountDetailView,
  type AccountUpdateRequest,
} from "@ampm/core";

/*
 * Pure form logic for editing a client account's details (TW-13 Overview and Notes): the name, the
 * couple, the preferred locations and the internal notes. The body holds only what changed and an
 * emptied optional box clears its field; the account name may not be emptied.
 */

export interface DetailsDraft {
  readonly name: string;
  readonly coupleNames: string;
  readonly preferredLocations: string;
  readonly internalNotes: string;
}

export interface DetailsErrors {
  readonly name: string | undefined;
}

type DetailsField = keyof DetailsDraft;
const FIELDS: readonly DetailsField[] = [
  "name",
  "coupleNames",
  "preferredLocations",
  "internalNotes",
];

/** The draft of the account's details as they stand. */
export function detailsDraftOf(account: AccountDetailView): DetailsDraft {
  return {
    name: account.name,
    coupleNames: account.coupleNames ?? "",
    preferredLocations: account.preferredLocations ?? "",
    internalNotes: account.internalNotes ?? "",
  };
}

export function validateDetails(draft: DetailsDraft): DetailsErrors {
  return { name: draft.name.trim() === "" ? "Enter the client's name" : undefined };
}

/**
 * The edit body (`PATCH /crm/accounts/:id`) holding only the changed fields, or `null` when nothing
 * changed (the sheet closes without a request). Call it once `validateDetails` has no errors.
 */
export function buildDetailsUpdate(
  draft: DetailsDraft,
  account: AccountDetailView,
): AccountUpdateRequest | null {
  const current = detailsDraftOf(account);
  const changes: Record<string, string | null> = {};
  for (const field of FIELDS) {
    const value = draft[field].trim();
    if (value === current[field].trim()) continue;
    changes[field] = field === "name" || value !== "" ? value : null;
  }
  if (Object.keys(changes).length === 0) return null;
  const parsed = accountUpdateRequest.safeParse(changes);
  return parsed.success ? parsed.data : null;
}
