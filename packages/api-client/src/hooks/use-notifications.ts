import { useQuery } from "@tanstack/react-query";
import { notificationView, page } from "@ampm/core";

import { useApiClient } from "../provider";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** The signed-in user's notifications from `GET /notifications` — the in-app inbox. */
export function useNotifications() {
  const api = useApiClient();
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/notifications", page(notificationView), signal),
  });
}
