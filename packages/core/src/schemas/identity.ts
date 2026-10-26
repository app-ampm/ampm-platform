import { z } from "zod";

import { isoDateTime, uuid } from "./common";

/** The five principal kinds of the authorisation model (permission-matrix §1, architecture §6). */
export const principalType = z.enum(["staff", "client", "demo", "guest", "system"]);
export type PrincipalType = z.infer<typeof principalType>;

export const staffRoleCode = z.enum(["SA", "SM", "HT", "PM", "CD", "VC", "RG", "HL", "FA"]);
export type StaffRoleCode = z.infer<typeof staffRoleCode>;

export const projectRole = z.enum(["project_lead", "staff", "client_representative"]);
export const clientSide = z.enum(["bride", "groom"]);

export const membership = z.object({
  projectId: uuid,
  projectRole,
  clientSide: clientSide.nullable(),
  canViewFinance: z.boolean(),
  canApprove: z.boolean(),
});
export type Membership = z.infer<typeof membership>;

/** The modules a client principal may reach (permission-matrix §3). */
export const entitlementModule = z.enum([
  "hotel_discovery",
  "saved_hotels",
  "hotel_assistance",
  "wedding_workspace",
  "client_finance",
  "guests_rsvp",
  "menus",
  "support",
  "live_chat",
]);
export type EntitlementModule = z.infer<typeof entitlementModule>;

/**
 * `GET /me`: what the signed-in principal is, from the API's own records. The identity service
 * only proves who is calling; roles, memberships and entitlements live here (T-6).
 */
export const meResponse = z.object({
  principal: z.object({
    type: principalType,
    userId: uuid,
    name: z.string(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    status: z.enum(["invited", "active", "disabled", "locked"]),
    lastLoginAt: isoDateTime.nullable(),
  }),
  roles: z.array(staffRoleCode),
  memberships: z.array(membership),
  entitlements: z.object({ modules: z.array(entitlementModule) }),
  isDemo: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponse>;
