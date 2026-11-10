import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configListView, configView, type ConfigView } from "@ampm/core";

import { useApiClient } from "../provider";

export const CONFIGURATIONS_QUERY_KEY = ["configurations"] as const;

/** The body of a configuration write: the key to set and its new value (validated on the server). */
export interface UpdateConfigurationInput {
  readonly key: string;
  readonly value: unknown;
}

/**
 * The configuration inventory (`GET /admin/configurations`, `admin.configurations.read` — Super Admin
 * and Finance): every key and its current value — the platform's thresholds, policies, defaults and
 * feature switches — each as the generic `{ key, value }` view. Configuration, not code (api.md): a
 * Super Admin edits a value through `PUT /admin/configurations/:key` (`admin.configurations.update`).
 * The hook returns the entries array; the response envelope's `{ entries }` is unwrapped here.
 */
export function useConfigurations() {
  const api = useApiClient();
  return useQuery<ConfigView[]>({
    queryKey: CONFIGURATIONS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const view = await api.get("/admin/configurations", configListView, signal);
      return view.entries;
    },
  });
}

/**
 * Set one configuration value (`PUT /admin/configurations/:key`, `admin.configurations.update` — Super
 * Admin only; Finance may read configuration but not write it). The value is validated against the
 * key's own schema on the server, so an invalid value comes back as `validation_failed`. On success the
 * inventory query is refreshed, so the new value shows the moment the sheet closes.
 */
export function useUpdateConfiguration() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<ConfigView, Error, UpdateConfigurationInput>({
    mutationFn: ({ key, value }) =>
      api.request(`/admin/configurations/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: { value },
        schema: configView,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_QUERY_KEY });
    },
  });
}
