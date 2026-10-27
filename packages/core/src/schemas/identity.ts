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
 * Which hotels hotel discovery reaches (permission-matrix §3, first column): full search with an
 * active subscription, otherwise the project's, the agreement's or the demo set's hotels only.
 *
 * @example
 * const searchAll = me.entitlements.hotelReach.includes("all_hotels");
 */
export const hotelReach = z.enum([
  "all_hotels",
  "project_hotels",
  "agreement_hotels",
  "demo_hotels",
]);
/** @example const reach: HotelReach = "project_hotels"; */
export type HotelReach = z.infer<typeof hotelReach>;

/**
 * Which records client finance reaches (§3): a lapsed subscription the account's own invoices and
 * payments (line 97), an agreement that service's invoices (line 98), the demo its sample
 * (line 94). No value names a wedding's finance, which waits for AMPM's answer (Q4, line 99).
 *
 * @example
 * const showInvoices = me.entitlements.financeReach.includes("own_invoices");
 */
export const financeReach = z.enum(["own_invoices", "agreement_invoices", "demo_sample"]);
/** @example const reach: FinanceReach = "agreement_invoices"; */
export type FinanceReach = z.infer<typeof financeReach>;

/**
 * The kinds of client request, `client_requests.request_type` (data-model.md line 1210).
 *
 * @example
 * const kind = requestType.parse(body.requestType);
 */
export const requestType = z.enum(["question", "change_request", "support"]);
/** @example const kind: RequestType = "support"; */
export type RequestType = z.infer<typeof requestType>;

/**
 * What a client principal may reach and how far, as @ampm/policy resolves it (§3): the modules,
 * the read-only ones, the hotels and finance records reached, the request types it may create.
 *
 * @example
 * const writable = (module: EntitlementModule) => !me.entitlements.readOnlyModules.includes(module);
 */
export const entitlements = z.object({
  modules: z.array(entitlementModule),
  readOnlyModules: z.array(entitlementModule),
  hotelReach: z.array(hotelReach),
  financeReach: z.array(financeReach),
  // Apart by where the request goes: a closed wedding takes support only, whatever the account
  // allows (§3 lines 96-101).
  requestTypes: z.object({ wedding: z.array(requestType), account: z.array(requestType) }),
});

/**
 * `GET /me`: what the signed-in principal is, from the API's own records. The identity service
 * only proves who is calling; roles, memberships and entitlements live here (T-6).
 *
 * @example
 * return meResponse.parse({ principal, roles, memberships, entitlements, isDemo });
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
  entitlements,
  isDemo: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponse>;
