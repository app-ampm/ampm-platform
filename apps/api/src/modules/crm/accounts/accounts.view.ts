import type { AccountContactView, AccountDetailView, AccountView } from "@ampm/core";

import type { AccountContactRow, AccountDetailRow, AccountRow } from "./accounts.repository.js";

/** The staff account view: CLIENT-class fields plus `internalNotes` (RESTRICTED-NOTES, staff-only);
 *  billing fields are never present on this path (the repository does not read them). */
export function toAccountView(row: AccountRow): AccountView {
  return {
    id: row.id,
    name: row.name,
    coupleNames: row.coupleNames,
    preferredLocations: row.preferredLocations,
    status: row.status,
    isDemo: row.isDemo,
    leadId: row.leadId,
    primaryContactUserId: row.primaryContactUserId,
    internalNotes: row.internalNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAccountContactView(row: AccountContactRow): AccountContactView {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    relation: row.relation,
    phone: row.phone,
    email: row.email,
    isDecisionMaker: row.isDecisionMaker,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAccountDetailView(row: AccountDetailRow): AccountDetailView {
  return { ...toAccountView(row), contacts: row.contacts.map(toAccountContactView) };
}
