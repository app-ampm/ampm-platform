import { useQuery } from "@tanstack/react-query";
import { auditEventPage, type AuditEventPage, type AuditEventQuery } from "@ampm/core";

import { useApiClient } from "../provider";

export const AUDIT_EVENTS_QUERY_KEY = ["admin", "audit-events"] as const;

function auditEventsPath(query: Partial<AuditEventQuery>): string {
  const params = new URLSearchParams();
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.entityId) params.set("entityId", query.entityId);
  if (query.actorUserId) params.set("actorUserId", query.actorUserId);
  if (query.action) params.set("action", query.action);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/admin/audit-events?${params.toString()}`;
}

/**
 * The append-only audit log (`GET /admin/audit-events`, `admin.audit_log.read`), newest first,
 * cursor-paginated. Super-Admin only — the guard denies PM/FA on this cross-project surface.
 */
export function useAuditEvents(query: Partial<AuditEventQuery> = {}) {
  const api = useApiClient();
  return useQuery<AuditEventPage>({
    queryKey: [...AUDIT_EVENTS_QUERY_KEY, query],
    queryFn: ({ signal }) => api.get(auditEventsPath(query), auditEventPage, signal),
  });
}
