import { Injectable } from "@nestjs/common";
import type {
  SubscriptionReportExport,
  SubscriptionReportExportQuery,
  SubscriptionReportPage,
  SubscriptionReportQuery,
} from "@ampm/core";

import { AuditService } from "../../../policy/audit.service.js";
import { SubscriptionReportRepository } from "./subscription-report.repository.js";
import { toSubscriptionReportRow } from "./subscription-report.view.js";

/** The all-zero UUID: the audit subject for an export of the whole report (no single record). */
const WHOLE_REPORT = "00000000-0000-0000-0000-000000000000";
/** The most rows one export carries; more are left out and the export says it was truncated. */
const MAX_EXPORT_ROWS = 5_000;

/**
 * The "Subscription status and payment history" report (permission-matrix §5.16: SA, SM, FA). Finance
 * lists the subscriptions it records manual payments against through it (D-127). Every field is
 * CLIENT-class, so a run is not a restricted read and is not audited; an export is (security.md), with
 * its filters and row count, whoever runs it (SA and FA hold `.export`; D-128).
 */
@Injectable()
export class SubscriptionReportService {
  constructor(
    private readonly report: SubscriptionReportRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: SubscriptionReportQuery): Promise<SubscriptionReportPage> {
    const { rows, nextCursor } = await this.report.list(query.status, query.limit, query.cursor);
    return { items: rows.map(toSubscriptionReportRow), nextCursor };
  }

  async export(filters: SubscriptionReportExportQuery): Promise<SubscriptionReportExport> {
    const { rows, truncated } = await this.report.export(filters.status, MAX_EXPORT_ROWS);
    // The after-image is the query's filters, not personal data, so it is kept verbatim (maskImages:
    // false), as the audit-log export records its own.
    await this.audit.record({
      action: "export",
      entityType: "subscription_report",
      entityId: WHOLE_REPORT,
      after: { filters, rowCount: rows.length, truncated },
      maskImages: false,
    });
    return {
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      truncated,
      filters,
      rows: rows.map(toSubscriptionReportRow),
    };
  }
}
