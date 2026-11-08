import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  capabilityView,
  roleView,
  type AssignRoleRequest,
  type CapabilityView,
  type RoleCreateRequest,
  type RoleUpdateRequest,
  type RoleView,
} from "@ampm/core";
import { z } from "zod";

import { useApiClient } from "../provider";
import { STAFF_USERS_QUERY_KEY } from "./use-staff-users";

export const ROLES_QUERY_KEY = ["admin", "roles"] as const;
export const ASSIGNABLE_ROLES_QUERY_KEY = ["admin", "roles", "assignable"] as const;
export const CAPABILITIES_QUERY_KEY = ["admin", "capabilities"] as const;

const roleList = z.array(roleView);
const capabilityList = z.array(capabilityView);
/** Assign, unassign and delete return no body (the envelope's `data` is absent); accept and ignore it. */
const emptyResponse = z.unknown();

/**
 * The custom roles a Super Admin manages (`GET /admin/roles`, `admin.roles.read`): the editor's
 * working set, system roles excluded. For assigning a role or viewing the permission model, use
 * {@link useAssignableRoles}, which returns every role. Super-Admin only, server-enforced.
 */
export function useRoles() {
  const api = useApiClient();
  return useQuery<RoleView[]>({
    queryKey: ROLES_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/admin/roles", roleList, signal),
  });
}

/**
 * Every assignable role — the nine system roles (Sales, Finance, …) and any custom roles — each with
 * its resolved capabilities, system roles first (`GET /admin/roles/assignable`, `admin.roles.read`).
 * The source for both assigning a role to a staff user and the roles-and-permissions viewer, because a
 * staff user may hold either kind. Super-Admin only, server-enforced.
 */
export function useAssignableRoles() {
  const api = useApiClient();
  return useQuery<RoleView[]>({
    queryKey: ASSIGNABLE_ROLES_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/admin/roles/assignable", roleList, signal),
  });
}

/**
 * The capabilities a custom role may be granted — the Super-Admin pick-list (`GET /admin/capabilities`,
 * `admin.roles.read`): every staff capability that is not escalation-locked. Super-Admin only.
 */
export function useCapabilities() {
  const api = useApiClient();
  return useQuery<CapabilityView[]>({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/admin/capabilities", capabilityList, signal),
  });
}

/** Refresh the custom working set and the assignable set after a custom-role change. */
function useRefreshRoles(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ASSIGNABLE_ROLES_QUERY_KEY });
  };
}

/**
 * Create a custom role from catalog capabilities (`POST /admin/roles`, `admin.roles.create`). Refreshes
 * the role lists so it appears for viewing and assignment. Super-Admin only, server-enforced.
 */
export function useCreateRole() {
  const api = useApiClient();
  const refresh = useRefreshRoles();
  return useMutation<RoleView, Error, RoleCreateRequest>({
    mutationFn: (body) => api.request("/admin/roles", { method: "POST", body, schema: roleView }),
    onSuccess: refresh,
  });
}

/** Rename a custom role and/or replace its capabilities (`PATCH /admin/roles/:id`, `admin.roles.update`). */
export function useUpdateRole() {
  const api = useApiClient();
  const refresh = useRefreshRoles();
  return useMutation<
    RoleView,
    Error,
    { readonly roleId: string; readonly body: RoleUpdateRequest }
  >({
    mutationFn: ({ roleId, body }) =>
      api.request(`/admin/roles/${roleId}`, { method: "PATCH", body, schema: roleView }),
    onSuccess: refresh,
  });
}

/** Delete a custom role (`DELETE /admin/roles/:id`, `admin.roles.delete`); the holders' sessions end. */
export function useDeleteRole() {
  const api = useApiClient();
  const refresh = useRefreshRoles();
  return useMutation<unknown, Error, string>({
    mutationFn: (roleId) =>
      api.request(`/admin/roles/${roleId}`, { method: "DELETE", schema: emptyResponse }),
    onSuccess: refresh,
  });
}

/**
 * Assign a role to a staff user (`POST /admin/users/:userId/roles`, `admin.staff_users.update`). The
 * server revokes the user's sessions so the new grant takes effect at once; this refreshes the record.
 */
export function useAssignStaffRole(userId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, AssignRoleRequest>({
    mutationFn: (body) =>
      api.request(`/admin/users/${userId}/roles`, { method: "POST", body, schema: emptyResponse }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}

/** Remove a role from a staff user (`DELETE /admin/users/:userId/roles/:roleId`). */
export function useUnassignStaffRole(userId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (roleId) =>
      api.request(`/admin/users/${userId}/roles/${roleId}`, {
        method: "DELETE",
        schema: emptyResponse,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_USERS_QUERY_KEY });
    },
  });
}
