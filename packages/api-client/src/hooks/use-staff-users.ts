import { useQuery } from "@tanstack/react-query";
import {
  staffUserPage,
  staffUserView,
  type StaffUserPage,
  type StaffUserQuery,
  type StaffUserView,
} from "@ampm/core";

import { useApiClient } from "../provider";

export const STAFF_USERS_QUERY_KEY = ["admin", "staff-users"] as const;

function staffUsersPath(query: Partial<StaffUserQuery>): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/admin/staff-users?${params.toString()}`;
}

/**
 * The staff directory (`GET /admin/staff-users`, `admin.staff_users.read`), newest-first keyset pages.
 * Every staff role may read it; create, update, status and reinvite are Super Admin, server-enforced.
 */
export function useStaffUsers(query: Partial<StaffUserQuery> = {}) {
  const api = useApiClient();
  return useQuery<StaffUserPage>({
    queryKey: [...STAFF_USERS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(staffUsersPath(query), staffUserPage, signal),
  });
}

/** The query key for one staff user, so a later mutation can target or invalidate it. */
export function staffUserQueryKey(userId: string) {
  return [...STAFF_USERS_QUERY_KEY, userId] as const;
}

/** One staff user (`GET /admin/staff-users/:id`, `admin.staff_users.read`). 404 if not visible. */
export function useStaffUser(userId: string) {
  const api = useApiClient();
  return useQuery<StaffUserView>({
    queryKey: staffUserQueryKey(userId),
    queryFn: ({ signal }) => api.get(`/admin/staff-users/${userId}`, staffUserView, signal),
    enabled: Boolean(userId),
  });
}
