import { useMutation } from "@tanstack/react-query";
import { auditExport, type AuditExport, type AuditExportQuery } from "@ampm/core";

import { useApiClient } from "../provider";

function auditExportPath(query: AuditExportQuery): string {
  const params = new URLSearchParams();
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.entityId) params.set("entityId", query.entityId);
  if (query.actorUserId) params.set("actorUserId", query.actorUserId);
  if (query.action) params.set("action", query.action);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return `/admin/audit-events/export${qs ? `?${qs}` : ""}`;
}

/**
 * The audit-log export (`GET /admin/audit-events/export`, `admin.audit_log.export`). Run on demand
 * (a button): it returns the whole filtered set (capped, `truncated` when the cap was hit), which the
 * caller renders to CSV and downloads. The server audits the export itself.
 */
export function useAuditExport() {
  const api = useApiClient();
  return useMutation<AuditExport, Error, AuditExportQuery>({
    mutationFn: (filters) => api.get(auditExportPath(filters), auditExport),
  });
}
