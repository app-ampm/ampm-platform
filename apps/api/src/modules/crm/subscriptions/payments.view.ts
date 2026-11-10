import type { PaymentFinanceView } from "@ampm/core";

import { toClientMoney } from "./money.js";
import type { PaymentRow } from "./payments.repository.js";

/**
 * A payment as Finance sees it (RESTRICTED-FINANCE — `crm.payments.read`, FA/SA only, never a client).
 * Every finance-internal field is present: direction, provider and its reference, the counterparty
 * link, and who recorded it. The amount reuses the one numeric→paise serialiser (money.ts); it is an
 * INR money value on the wire, and the audience guard is the route — this view is only returned to FA/SA.
 */
export function toPaymentFinanceView(row: PaymentRow): PaymentFinanceView {
  return {
    id: row.id,
    accountId: row.accountId,
    direction: row.direction,
    purpose: row.purpose,
    amount: toClientMoney(row.amount),
    method: row.method,
    status: row.status,
    provider: row.provider,
    providerRef: row.providerRef,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    recordedBy: row.recordedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
