import { formatDay, type StaffUserView, type UserStatus } from "@ampm/core";
import { STAFF_ROLES } from "@ampm/policy";
import type { StatusTone } from "@ampm/ui";

/*
 * Presentation helpers for the admin console's staff directory (TW-90): the labels and chip treatments
 * for an account's status and authenticator state, and role keys as their display names. No data
 * fetching and no business rules — the status machine lives on the server.
 */

const STATUS_LABEL: Record<UserStatus, string> = {
  invited: "Invited",
  active: "Active",
  disabled: "Disabled",
  locked: "Locked",
};

/**
 * The chip treatment per account status (docs/design/peacock-night.md §8): peacock once active, gold
 * soft while an invite is outstanding, gold solid when the identity service has locked the account
 * (it needs attention), pearl once disabled.
 */
const STATUS_TONE: Record<UserStatus, StatusTone> = {
  invited: "warning",
  active: "success",
  disabled: "neutral",
  locked: "danger",
};

export function userStatusLabel(status: UserStatus): string {
  return STATUS_LABEL[status];
}

export function userStatusTone(status: UserStatus): StatusTone {
  return STATUS_TONE[status];
}

// The staff-user view carries role *keys* ("super_admin", "sales"), the roleKey column the API
// serialises — not the "SA"/"SM" codes `me.roles` uses — so the lookup is keyed by `.key`.
const ROLE_NAME_BY_KEY = new Map<string, string>(
  Object.values(STAFF_ROLES).map((role) => [role.key, role.name]),
);

/** A role key as its display name ("super_admin" → "Super Admin"); an unknown key shows as itself. */
export function roleName(roleKey: string): string {
  return ROLE_NAME_BY_KEY.get(roleKey) ?? roleKey;
}

/** The user's roles as one line: "Super Admin, Finance"; "No roles" when they hold none. */
export function roleSummary(roles: readonly string[]): string {
  return roles.length > 0 ? roles.map(roleName).join(", ") : "No roles";
}

/** Last sign-in as a data date ("2 NOV 2026"), or "Never" when they have not signed in. */
export function lastSignInLabel(lastLoginAt: string | null): string {
  return lastLoginAt ? formatDay(lastLoginAt, { style: "data" }) : "Never";
}

/** The authenticator-app enrolment as a short chip label (staff sign in with a password plus a code). */
export function authenticatorLabel(mfaEnabled: boolean): string {
  return mfaEnabled ? "Authenticator on" : "No authenticator";
}

export function authenticatorTone(mfaEnabled: boolean): StatusTone {
  return mfaEnabled ? "success" : "info";
}

/** What a directory row reads after the name, for a screen reader: the roles and the status. */
export function staffUserSummary(user: StaffUserView): string {
  return `${roleSummary(user.roles)}, ${userStatusLabel(user.status)}`;
}
