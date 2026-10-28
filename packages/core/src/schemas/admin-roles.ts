import { z } from "zod";

import { uuid } from "./common.js";

/*
 * Contracts for the Super-Admin role administration surface (D-036): the capability pick-list, custom
 * roles and their grants, and role assignment. One schema, three consumers (api.md).
 */

/** A grantable capability as the Super-Admin editor shows it — the pick-list. Its `id` is the catalog key. */
export const capabilityView = z.object({
  id: z.string(),
  module: z.string(),
  resource: z.string(),
  action: z.string(),
  scope: z.string(),
  label: z.string(),
  isEscalationLocked: z.boolean(),
  sourceRoles: z.array(z.string()),
});
export type CapabilityView = z.infer<typeof capabilityView>;

/** A role with its resolved capabilities. */
export const roleView = z.object({
  id: uuid,
  roleKey: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  capabilities: z.array(capabilityView),
});
export type RoleView = z.infer<typeof roleView>;

/** Create a custom role from catalog capability ids. */
export const roleCreateRequest = z.object({
  name: z.string().min(1).max(255),
  capabilityIds: z.array(z.string().min(1)).default([]),
});
export type RoleCreateRequest = z.infer<typeof roleCreateRequest>;

/** Rename a custom role and/or replace its capabilities (an absent field is left unchanged). */
export const roleUpdateRequest = z
  .object({
    name: z.string().min(1).max(255).optional(),
    capabilityIds: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => value.name !== undefined || value.capabilityIds !== undefined, {
    message: "give a name or capabilityIds to change",
  });
export type RoleUpdateRequest = z.infer<typeof roleUpdateRequest>;

/** Assign a role (system or custom) to a user. */
export const assignRoleRequest = z.object({ roleId: uuid });
export type AssignRoleRequest = z.infer<typeof assignRoleRequest>;
