import { z } from "zod";

import { clientSide } from "./identity.js";
import { userStatus } from "./staff-users.js";
import { uuid } from "./common.js";

/*
 * Contracts for client-login administration (Module A, sprint-4 feature 5.3): the client-representative
 * portal logins of one wedding (Q5: at most two per wedding, one per side). This is the admin's view of
 * a login (SA/SM, or PM on their projects set the membership flags); it never carries the identity
 * subject or any token. Invite delivery and activation reuse feature 5.2.
 */

export type ClientSide = z.infer<typeof clientSide>;

export const membershipStatus = z.enum(["invited", "active", "removed"]);
export type MembershipStatus = z.infer<typeof membershipStatus>;

/** One client-representative login on a wedding, as the admin surface shows it. */
export const clientLoginView = z.object({
  userId: uuid,
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  userStatus,
  clientSide: clientSide.nullable(),
  canViewFinance: z.boolean(),
  canApprove: z.boolean(),
  membershipStatus,
  invitedAt: z.string().datetime().nullable(),
});
export type ClientLoginView = z.infer<typeof clientLoginView>;

/** Create a client-representative login on a wedding; they start `invited` (feature 5.2 activates). */
export const clientLoginCreateRequest = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(32).optional(),
  clientSide,
  canViewFinance: z.boolean().optional(),
  canApprove: z.boolean().optional(),
});
export type ClientLoginCreateRequest = z.infer<typeof clientLoginCreateRequest>;

/** Change a client login's finance/approval flags; an absent field is left unchanged. */
export const clientLoginUpdateRequest = z
  .object({
    canViewFinance: z.boolean().optional(),
    canApprove: z.boolean().optional(),
  })
  .refine((v) => v.canViewFinance !== undefined || v.canApprove !== undefined, {
    message: "give canViewFinance or canApprove to change",
  });
export type ClientLoginUpdateRequest = z.infer<typeof clientLoginUpdateRequest>;

/** A wedding's client logins (bounded to two, so unpaginated). */
export const clientLoginList = z.object({ items: z.array(clientLoginView) });
export type ClientLoginList = z.infer<typeof clientLoginList>;
