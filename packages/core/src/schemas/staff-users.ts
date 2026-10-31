import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";

/*
 * Contracts for staff-user administration (Module A, sprint-4 feature 5.1). The view never carries the
 * identity subject or any token — those are RESTRICTED. Role assignment is the separate /admin/users
 * surface (slice 6a); invite delivery and activation are feature 5.2. One schema, three consumers.
 */

/** The account statuses (schema.prisma UserStatus); `locked` is set by the identity service, not here. */
export const userStatus = z.enum(["invited", "active", "disabled", "locked"]);
export type UserStatus = z.infer<typeof userStatus>;

/** A staff user as the admin directory shows it. */
export const staffUserView = z.object({
  id: uuid,
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  status: userStatus,
  mfaEnabled: z.boolean(),
  lastLoginAt: isoDateTime.nullable(),
  roles: z.array(z.string()),
  createdAt: isoDateTime,
});
export type StaffUserView = z.infer<typeof staffUserView>;

/** Create a staff user; they start `invited` (feature 5.2 sends the invite and activates them). */
export const staffUserCreateRequest = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(32).optional(),
});
export type StaffUserCreateRequest = z.infer<typeof staffUserCreateRequest>;

/** Update a staff user's profile fields; an absent field is left unchanged, at least one required. */
export const staffUserUpdateRequest = z
  .object({
    name: z.string().min(1).max(255).optional(),
    phone: z.string().max(32).nullable().optional(),
    mfaEnabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined || v.mfaEnabled !== undefined, {
    message: "give a name, phone or mfaEnabled to change",
  });
export type StaffUserUpdateRequest = z.infer<typeof staffUserUpdateRequest>;

/** Enable or disable a staff user. `invited`/`active` → `disabled`, `disabled` → `active`. */
export const staffUserStatusRequest = z.object({
  status: z.enum(["active", "disabled"]),
});
export type StaffUserStatusRequest = z.infer<typeof staffUserStatusRequest>;

/** List query: newest-first keyset pagination (cursor is a prior user's uuid id) with a status filter. */
export const staffUserQuery = cursorQuery
  .extend({ cursor: uuid.optional() })
  .extend({ status: userStatus.optional() });
export type StaffUserQuery = z.infer<typeof staffUserQuery>;

export const staffUserPage = page(staffUserView);
export type StaffUserPage = z.infer<typeof staffUserPage>;
