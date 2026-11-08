import { Controller, Get } from "@nestjs/common";
import { paymentListQuery, type PaymentListQuery, type PaymentPage } from "@ampm/core";

import { ZodQuery } from "../../../common/zod.js";
import { RequirePermission } from "../../../policy/decorators.js";
import { PaymentsService } from "./payments.service.js";

/**
 * The finance payment ledger (Module B CRM; `crm.payments.read`, FA/SA). A read-only view over the
 * recorded inbound and outbound payments — the RESTRICTED-FINANCE counterpart to the record-payment
 * write on subscriptions — narrowed by account and direction and cursor-paginated. The service audits
 * each read; denial is the matrix's (a role without the key gets the standard 403).
 */
@Controller("crm")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("payments")
  @RequirePermission("crm.payments.read")
  list(@ZodQuery(paymentListQuery) query: PaymentListQuery): Promise<PaymentPage> {
    return this.payments.list(query);
  }
}
