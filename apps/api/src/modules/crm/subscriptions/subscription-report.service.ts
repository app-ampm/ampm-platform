import { Injectable } from "@nestjs/common";
import type { SubscriptionReportPage, SubscriptionReportQuery } from "@ampm/core";

import { SubscriptionReportRepository } from "./subscription-report.repository.js";
import { toSubscriptionReportRow } from "./subscription-report.view.js";

/**
 * The "Subscription status and payment history" report (permission-matrix §5.16: SA, SM, FA). Finance
 * lists the subscriptions it records manual payments against through it (D-127). Every field is
 * CLIENT-class, so a run is not a restricted read and is not audited; the export, when it lands, is.
 */
@Injectable()
export class SubscriptionReportService {
  constructor(private readonly report: SubscriptionReportRepository) {}

  async list(query: SubscriptionReportQuery): Promise<SubscriptionReportPage> {
    const { rows, nextCursor } = await this.report.list(query.status, query.limit, query.cursor);
    return { items: rows.map(toSubscriptionReportRow), nextCursor };
  }
}
