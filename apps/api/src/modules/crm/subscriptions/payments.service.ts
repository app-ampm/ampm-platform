import { Injectable } from "@nestjs/common";
import type { PaymentListQuery, PaymentPage } from "@ampm/core";

import { AuditService } from "../../../policy/audit.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { toPaymentFinanceView } from "./payments.view.js";

/** The all-zero UUID: the audit subject for a read of the whole ledger (no single account). */
const WHOLE_LEDGER = "00000000-0000-0000-0000-000000000000";

/**
 * The finance payment ledger read (`crm.payments.read` — FA/SA; the RESTRICTED-FINANCE counterpart to
 * the record-payment write on subscriptions). Returns the finance view of inbound and outbound payments,
 * cursor-paginated newest-first; `accountId` narrows to one client, `direction` to receipts or
 * settlements. Every read is audited as a `restricted_read` (security.md: a RESTRICTED-FINANCE read — in
 * particular a Super Admin's break-glass read outside Finance — is recorded) with the filter and the
 * row count, so a scan of the ledger always leaves a trail.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaymentListQuery): Promise<PaymentPage> {
    const { rows, nextCursor } = await this.payments.list(
      { accountId: query.accountId, direction: query.direction },
      query.limit,
      query.cursor,
    );
    await this.audit.record({
      action: "restricted_read",
      entityType: "payment_ledger",
      entityId: query.accountId ?? WHOLE_LEDGER,
      after: {
        accountId: query.accountId ?? null,
        direction: query.direction ?? null,
        count: rows.length,
      },
    });
    return { items: rows.map(toPaymentFinanceView), nextCursor };
  }
}
