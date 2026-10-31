import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";
import { indianPhone } from "./leads.js";

/*
 * Contracts for client accounts and their contacts (Module B CRM, feature 8.2): the Convert action
 * (TW-11, AC-01.8) that turns a lead into a `client_accounts` row with a primary contact and a portal
 * invite, plus the staff read views. Billing fields are RESTRICTED-BANK and `internal_notes` is
 * RESTRICTED-NOTES (field-matrix §4): neither is ever serialised to a client. Per security.md there is
 * one response model per audience, so the client view is a separate, narrower schema — never a flag
 * that hides a field. Convert does not set billing (Finance adds it later through its own path).
 */

export const clientAccountStatus = z.enum(["prospect", "active", "suspended", "closed"]);
export type ClientAccountStatus = z.infer<typeof clientAccountStatus>;

const accountName = z.string().trim().min(1).max(255);
const coupleNames = z.string().trim().max(255);
const preferredLocations = z.string().trim().max(10_000);
const contactName = z.string().trim().min(1).max(255);
const relation = z.string().trim().min(1).max(255);
const contactEmail = z.string().trim().toLowerCase().email().max(255);

/**
 * The Convert action (TW-11, AC-01.8): Sales turns a lead into a client account and invites the primary
 * contact to the portal. The contact email is required because the invite is delivered by email
 * (AUTH-02); every other field defaults from the lead in the service, so the minimal body is just the
 * contact's email. No account is ever created except through this action (WHY §4).
 */
export const leadConvertRequest = z.object({
  /** Couple or family name for the account; defaults to the lead's name when omitted. */
  accountName: accountName.optional(),
  coupleNames: coupleNames.optional(),
  preferredLocations: preferredLocations.optional(),
  primaryContact: z.object({
    name: contactName.optional(),
    relation: relation.optional(),
    email: contactEmail,
    phone: indianPhone.optional(),
    isDecisionMaker: z.boolean().default(true),
  }),
});
export type LeadConvertRequest = z.infer<typeof leadConvertRequest>;

/** A contact on a client account (staff view; every account_contacts field is CLIENT-class). */
export const accountContactView = z.object({
  id: uuid,
  accountId: uuid,
  name: z.string(),
  relation: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isDecisionMaker: z.boolean(),
  userId: uuid.nullable(),
  createdAt: isoDateTime,
});
export type AccountContactView = z.infer<typeof accountContactView>;

/**
 * A client account as staff see it (SA/SM/HT/PM). `internalNotes` is RESTRICTED-NOTES — staff with CRM
 * access only, never a client. Billing fields (RESTRICTED-BANK) are not in this operational view; a
 * Finance-facing billing model lands with the finance work.
 */
export const accountView = z.object({
  id: uuid,
  name: z.string(),
  coupleNames: z.string().nullable(),
  preferredLocations: z.string().nullable(),
  status: clientAccountStatus,
  isDemo: z.boolean(),
  leadId: uuid.nullable(),
  primaryContactUserId: uuid.nullable(),
  internalNotes: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type AccountView = z.infer<typeof accountView>;

/** A client account plus its contacts (account detail, TW-11). */
export const accountDetailView = accountView.extend({
  contacts: z.array(accountContactView),
});
export type AccountDetailView = z.infer<typeof accountDetailView>;

/**
 * A client account as the account's own client sees it (CP-01, when the portal lands). Excludes every
 * INTERNAL and RESTRICTED field — no billing, no internal_notes, no lead link, no demo flag — and is
 * strict, so a stray restricted field fails the schema (AC-12.3). No route serialises this yet; it
 * pins the contract that the portal will use.
 */
export const accountClientView = z
  .object({
    id: uuid,
    name: z.string(),
    coupleNames: z.string().nullable(),
    preferredLocations: z.string().nullable(),
    status: clientAccountStatus,
  })
  .strict();
export type AccountClientView = z.infer<typeof accountClientView>;

/**
 * The result of a convert (AC-01.8): the new account, its primary contact, and whether the portal
 * invite was queued. The invite token is always minted in the convert transaction; the notification is
 * best-effort after commit, so `inviteQueued=false` means "account created, re-send the invite".
 */
export const leadConvertResponse = z.object({
  account: accountView,
  primaryContact: accountContactView,
  inviteQueued: z.boolean(),
});
export type LeadConvertResponse = z.infer<typeof leadConvertResponse>;

/** List/filter client accounts (cursor-paginated by account id); `q` searches the name, `status`
 *  filters. The cursor is a UUID (the previous page's last id), validated at the edge so a malformed
 *  cursor is a 400, not a Postgres uuid-cast 500. */
export const accountListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  status: clientAccountStatus.optional(),
  q: z.string().trim().max(255).optional(),
});
export type AccountListQuery = z.infer<typeof accountListQuery>;

export const accountPage = page(accountView);
export type AccountPage = z.infer<typeof accountPage>;
