import { useQuery } from "@tanstack/react-query";
import { notificationPage, type NotificationPage } from "@ampm/core";

import { useApiClient } from "../provider";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/**
 * The notifications log (`GET /notifications`, `admin.notifications.read`): a normal staff role holds the
 * key at own scope and gets only its own notices; the Super Admin holds it at all scope and reads the
 * whole user log (permission-matrix §5.1). Cursor-paginated, newest first.
 */
export function useNotifications(limit = 50) {
  const api = useApiClient();
  return useQuery<NotificationPage>({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, { limit }],
    queryFn: ({ signal }) => api.get(`/notifications?limit=${limit}`, notificationPage, signal),
  });
}
