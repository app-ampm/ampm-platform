import { useQuery } from "@tanstack/react-query";
import { configListView, type ConfigView } from "@ampm/core";

import { useApiClient } from "../provider";

export const CONFIGURATIONS_QUERY_KEY = ["configurations"] as const;

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
