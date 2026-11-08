import { useQuery } from "@tanstack/react-query";
import { configView, notificationTemplates, type NotificationTemplates } from "@ampm/core";

import { useApiClient } from "../provider";

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
