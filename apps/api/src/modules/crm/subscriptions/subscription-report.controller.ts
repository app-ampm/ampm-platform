import { Controller, Get } from "@nestjs/common";
import {
  subscriptionReportExportQuery,
  subscriptionReportQuery,
  type SubscriptionReportExport,
  type SubscriptionReportExportQuery,
  type SubscriptionReportPage,
  type SubscriptionReportQuery,
} from "@ampm/core";

import { ZodQuery } from "../../../common/zod.js";
import { RequirePermission } from "../../../policy/decorators.js";
import { SubscriptionReportService } from "./subscription-report.service.js";

/**
 * The subscription status report (TW-83, permission-matrix §5.16). Super Admin, Sales and Finance may
 * run it; for Finance it is the way into the subscriptions awaiting a manual payment, which its
 * field-conditioned CRM grants cannot list (D-127). Any other role gets the guard's refusal.
 */
@Controller("crm")
export class SubscriptionReportController {
  constructor(private readonly report: SubscriptionReportService) {}

  @Get("reports/subscriptions")
  @RequirePermission("reports.subscription_status_payment_history.read")
  list(
    @ZodQuery(subscriptionReportQuery) query: SubscriptionReportQuery,
  ): Promise<SubscriptionReportPage> {
    return this.report.list(query);
  }

  /** The whole filtered report for a CSV, audited (§5.16: SA and FA export; Sales may only run it). */
  @Get("reports/subscriptions/export")
  @RequirePermission("reports.subscription_status_payment_history.export")
  export(
    @ZodQuery(subscriptionReportExportQuery) query: SubscriptionReportExportQuery,
  ): Promise<SubscriptionReportExport> {
    return this.report.export(query);
  }
}
