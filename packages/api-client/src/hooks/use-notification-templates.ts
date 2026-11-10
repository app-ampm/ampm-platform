import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configView, notificationTemplates, type NotificationTemplates } from "@ampm/core";

import { useApiClient } from "../provider";
import { CONFIGURATIONS_QUERY_KEY } from "./use-configurations";

export const NOTIFICATION_TEMPLATES_QUERY_KEY = ["notification-templates"] as const;

/** The configuration key the notification templates live under (api.md: templates are configuration). */
const TEMPLATES_CONFIG_KEY = "notification.templates";

/**
 * The notification templates (`GET /admin/configurations/notification.templates`,
 * `admin.configurations.read` — Super Admin and Finance): the per-channel message bodies the platform
 * sends, keyed by `templateKey`. Configuration, not code — a Super Admin edits them through
 * `PUT /admin/configurations/:key` (`admin.configurations.update`, Super Admin only). The response is
 * the generic `{ key, value }` config view; the
 * `value` is parsed against the templates schema so the hook returns the typed record.
 */
export function useNotificationTemplates() {
  const api = useApiClient();
  return useQuery<NotificationTemplates>({
    queryKey: NOTIFICATION_TEMPLATES_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const view = await api.get(
        `/admin/configurations/${TEMPLATES_CONFIG_KEY}`,
        configView,
        signal,
      );
      return notificationTemplates.parse(view.value);
    },
  });
}

/**
 * Save the whole notification-templates record (`PUT /admin/configurations/notification.templates`,
 * `admin.configurations.update` — Super Admin only). Templates are one configuration value, so an edit to
 * one template writes the full record back. The response's `value` is parsed to the typed record, and both
 * the templates view and the configuration inventory are refreshed so each shows the new content at once.
 */
export function useUpdateNotificationTemplates() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<NotificationTemplates, Error, NotificationTemplates>({
    mutationFn: async (templates) => {
      const view = await api.request(`/admin/configurations/${TEMPLATES_CONFIG_KEY}`, {
        method: "PUT",
        body: { value: templates },
        schema: configView,
      });
      return notificationTemplates.parse(view.value);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_TEMPLATES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_QUERY_KEY });
    },
  });
}
