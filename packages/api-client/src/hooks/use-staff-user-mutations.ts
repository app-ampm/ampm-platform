import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  staffUserView,
  type StaffUserCreateRequest,
  type StaffUserStatusRequest,
  type StaffUserUpdateRequest,
  type StaffUserView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { STAFF_USERS_QUERY_KEY } from "./use-staff-users";

/*
 * Super-Admin staff-user management (Module A, feature 5.1; TW-90). Each mutation returns the updated
 * StaffUserView and invalidates the directory key, which refreshes both the list and the open record
 * (the detail key is nested under it). The server enforces the Super-Admin permission; the UI shows
 * these only inside the Super-Admin-gated admin console.
 */

/**
 * Invite a staff member (`POST /admin/staff-users`, `admin.staff_users.create`; 201). They start
 * `invited`; feature 5.2 delivers the invite and activates them. A `conflict` means the email is taken.
 */
export function useInviteStaffUser() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<StaffUserView, Error, StaffUserCreateRequest>({
    mutationFn: (body) =>
      api.request("/admin/staff-users", { method: "POST", body, schema: staffUserView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}

/**
 * Update a staff member's profile fields (`PATCH /admin/staff-users/:id`, `admin.staff_users.update`).
 * Resetting the authenticator is `{ mfaEnabled: false }`, which forces re-enrolment at next sign-in.
 */
export function useUpdateStaffUser(userId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<StaffUserView, Error, StaffUserUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/admin/staff-users/${userId}`, { method: "PATCH", body, schema: staffUserView }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}

/**
 * Enable or disable a staff member (`PATCH /admin/staff-users/:id/status`, `admin.staff_users.update`):
 * invited/active → disabled, disabled → active.
 */
export function useSetStaffUserStatus(userId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<StaffUserView, Error, StaffUserStatusRequest>({
    mutationFn: (body) =>
      api.request(`/admin/staff-users/${userId}/status`, {
        method: "PATCH",
        body,
        schema: staffUserView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}

/** Resend a pending invitation (`POST /admin/staff-users/:id/reinvite`, `admin.staff_users.update`). */
export function useReinviteStaffUser(userId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<StaffUserView, Error, void>({
    mutationFn: () =>
      api.request(`/admin/staff-users/${userId}/reinvite`, {
        method: "POST",
        schema: staffUserView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}
