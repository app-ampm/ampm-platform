import { z } from "zod";

import { capabilityView } from "./admin-roles.js";
import { uuid } from "./common.js";

/*
 * Contracts for the Super-Admin permission-set surface (D-036, slice 6b): reusable bundles of catalog
 * capabilities, and attaching a set to a custom role. A role's effective grants are its direct grants
 * unioned with the grants of every set attached to it. One schema, three consumers (api.md).
 */

/** A permission set with its resolved capabilities. */
export const permissionSetView = z.object({
  id: uuid,
  setKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  capabilities: z.array(capabilityView),
});
export type PermissionSetView = z.infer<typeof permissionSetView>;

/** Create a permission set from catalog capability ids. */
export const permissionSetCreateRequest = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(255).optional(),
  capabilityIds: z.array(z.string().min(1)).default([]),
});
export type PermissionSetCreateRequest = z.infer<typeof permissionSetCreateRequest>;

/**
 * Rename a set, change its description (null clears it), and/or replace its capabilities. An absent
 * field is left unchanged; at least one must be given.
 */
export const permissionSetUpdateRequest = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).nullable().optional(),
    capabilityIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.capabilityIds !== undefined,
    { message: "give a name, description or capabilityIds to change" },
  );
export type PermissionSetUpdateRequest = z.infer<typeof permissionSetUpdateRequest>;

/** Attach a permission set to a custom role. */
export const attachPermissionSetRequest = z.object({ setId: uuid });
export type AttachPermissionSetRequest = z.infer<typeof attachPermissionSetRequest>;
