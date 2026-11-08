import type {
  AuditEventView,
  CapabilityView,
  ConfigView,
  NotificationView,
  RoleView,
  StaffUserView,
} from "@ampm/core";

import { failure, TEST_API_BASE } from "../../test/api";

export { failure, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for the admin console screens: a staff user in the exact shape `GET /admin/staff-users`
 * returns and a fetch that answers by path. The render under the API and the envelopes are the app's
 * (src/test/api). Imported by tests only.
 */

export const STAFF_USER_ID = "018f0000-0000-7000-8000-0000000005a1";
export const SECOND_STAFF_USER_ID = "018f0000-0000-7000-8000-0000000005a2";
const CREATED_AT = "2026-10-01T09:00:00Z";

/** An active Super Admin with an authenticator enrolled; override for the other states. */
export function staffUserFixture(overrides: Partial<StaffUserView> = {}): StaffUserView {
  return {
    id: STAFF_USER_ID,
    name: "Eva Menon",
    email: "eva@example.com",
    phone: "+919900000000",
    status: "active",
    mfaEnabled: true,
    lastLoginAt: "2026-11-02T08:30:00Z",
    roles: ["super_admin"],
    createdAt: CREATED_AT,
    ...overrides,
  };
}

const SA_ROLE_ID = "018f0000-0000-7000-8000-0000000006a1";
const FINANCE_ROLE_ID = "018f0000-0000-7000-8000-0000000006a2";

/** The roles catalogue as `GET /admin/roles/assignable` returns it (two system roles suffice for tests). */
export function rolesCatalogue(): RoleView[] {
  return [
    {
      id: SA_ROLE_ID,
      roleKey: "super_admin",
      name: "Super Admin",
      isSystem: true,
      capabilities: [],
    },
    {
      id: FINANCE_ROLE_ID,
      roleKey: "finance",
      name: "Finance / Accounts",
      isSystem: true,
      capabilities: [],
    },
  ];
}

/** One grantable capability as a role's resolved `capabilities[]` carries it. */
export function capabilityViewFixture(overrides: Partial<CapabilityView> = {}): CapabilityView {
  return {
    id: "weddings.weddings.read:assigned",
    module: "weddings",
    resource: "weddings",
    action: "read",
    scope: "assigned",
    label: "Read — Weddings (assigned)",
    isEscalationLocked: false,
    sourceRoles: ["PM"],
    ...overrides,
  };
}

/** A role as `GET /admin/roles/assignable` returns it; a system role with no capabilities by default. */
export function roleViewFixture(overrides: Partial<RoleView> = {}): RoleView {
  return {
    id: "018f0000-0000-7000-8000-0000000006b1",
    roleKey: "sales",
    name: "Sales / Relationship Manager",
    isSystem: true,
    capabilities: [],
    ...overrides,
  };
}

/** A staff-user update as `GET /admin/audit-events` returns it, with masked before/after images. */
export function auditEventFixture(overrides: Partial<AuditEventView> = {}): AuditEventView {
  return {
    id: "018f0000-0000-7000-8000-0000000007a1",
    actorUserId: STAFF_USER_ID,
    actorType: "user",
    action: "update",
    entityType: "staff_user",
    entityId: STAFF_USER_ID,
    projectId: null,
    before: { status: "invited" },
    after: { status: "active" },
    ipAddress: "203.0.113.4",
    requestId: "req_abc123",
    occurredAt: "2026-11-05T12:30:00Z",
    ...overrides,
  };
}

/** One notification as `GET /notifications` returns it: the delivery view, with no recipient field. */
export function notificationFixture(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    id: "018f0000-0000-7000-8000-0000000008a1",
    channel: "email",
    templateKey: "client.invite",
    status: "delivered",
    entityType: "client_account",
    entityId: STAFF_USER_ID,
    createdAt: "2026-11-05T12:30:00Z",
    sentAt: "2026-11-05T12:30:05Z",
    deliveredAt: "2026-11-05T12:30:09Z",
    ...overrides,
  };
}

/** The notification templates config as `GET /admin/configurations/notification.templates` returns it. */
export function notificationTemplatesConfig(): ConfigView {
  return {
    key: "notification.templates",
    value: {
      "staff.invite": {
        email: {
          subject: "Your AMPM invitation",
          html: "<p>Hi {{name}}, activate at {{activationUrl}}.</p>",
          text: "Hi {{name}}, activate at {{activationUrl}}.",
        },
      },
      "booking.reminder": {
        sms: { text: "Your site visit is on {{date}}." },
        push: { title: "Site visit", body: "Tomorrow at {{time}}." },
      },
    },
  };
}

export type FetchFn = typeof fetch;
type Route = (init: RequestInit | undefined) => Response;

/** A fetch that answers by path (no base, no query); every other path is a 404, as for a stranger. */
export function routedFetch(routes: Readonly<Record<string, Route>>): FetchFn {
  return (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    const route = routes[path];
    return Promise.resolve(route ? route(init) : failure("not_found", 404));
  };
}
