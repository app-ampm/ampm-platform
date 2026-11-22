import {
  accountUpdateRequest,
  coupleTitle,
  type AccountDetailView,
  type AccountUpdateRequest,
} from "@ampm/core";

/*
 * Pure form logic for editing a client account's details (TW-13 Overview and Notes): the name, the
 * couple (bride and groom, each with their father), the preferred locations and the internal notes.
 * The body holds only what changed and an emptied optional box clears its field. Once the bride and
 * groom are both named the client takes the couple's name, so the name box then follows them and is not
 * sent (the API renames the account); until then the name may not be emptied.
 */

export interface DetailsDraft {
  readonly name: string;
  readonly brideName: string;
  readonly brideFatherName: string;
  readonly groomName: string;
  readonly groomFatherName: string;
  readonly preferredLocations: string;
  readonly internalNotes: string;
}

export interface DetailsErrors {
  readonly name: string | undefined;
}

type DetailsField = keyof DetailsDraft;
const FIELDS: readonly DetailsField[] = [
  "name",
  "brideName",
  "brideFatherName",
  "groomName",
  "groomFatherName",
  "preferredLocations",
  "internalNotes",
];

/** The draft of the account's details as they stand. */
export function detailsDraftOf(account: AccountDetailView): DetailsDraft {
  return {
    name: account.name,
    brideName: account.brideName ?? "",
    brideFatherName: account.brideFatherName ?? "",
    groomName: account.groomName ?? "",
    groomFatherName: account.groomFatherName ?? "",
    preferredLocations: account.preferredLocations ?? "",
    internalNotes: account.internalNotes ?? "",
  };
}

/** The couple's name the draft gives the client ("Priya & Arjun"), or null while one is missing. */
export function draftCoupleTitle(draft: DetailsDraft): string | null {
  return coupleTitle({ brideName: draft.brideName, groomName: draft.groomName });
}

export function validateDetails(draft: DetailsDraft): DetailsErrors {
  const isNamedByCouple = draftCoupleTitle(draft) !== null;
  return {
    name: !isNamedByCouple && draft.name.trim() === "" ? "Enter the client's name" : undefined,
  };
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
  const isNamedByCouple = draftCoupleTitle(draft) !== null;
  const changes: Record<string, string | null> = {};
  for (const field of FIELDS) {
    if (field === "name" && isNamedByCouple) continue;
    const value = draft[field].trim();
    if (value === current[field].trim()) continue;
    changes[field] = field === "name" || value !== "" ? value : null;
  }
  if (Object.keys(changes).length === 0) return null;
  const parsed = accountUpdateRequest.safeParse(changes);
  return parsed.success ? parsed.data : null;
}
