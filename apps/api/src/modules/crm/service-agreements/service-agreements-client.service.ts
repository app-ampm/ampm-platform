import { Injectable } from "@nestjs/common";
import {
  errors,
  type ServiceAgreementClientPage,
  type ServiceAgreementClientView,
  type ServiceAgreementListQuery,
} from "@ampm/core";

import type { Principal } from "../../../policy/principal.types.js";
import { type AgreementRow, ServiceAgreementsRepository } from "./service-agreements.repository.js";
import { ServiceAgreementsService } from "./service-agreements.service.js";
import { toAgreementClientView } from "./service-agreements.view.js";

/**
 * The client's own view of the agreements AMPM has sent them, and the accept action (CP). This path is
 * account-scoped, NOT entitlement-gated: accepting is how the client earns the `hotel_assistance`
 * entitlement, so gating the accept on that entitlement would be circular. Anyone who is not a client
 * of an account is absence (404). The client only ever sees CLIENT fields (toAgreementClientView).
 */
@Injectable()
export class ServiceAgreementsClientService {
  constructor(
    private readonly agreements: ServiceAgreementsRepository,
    private readonly service: ServiceAgreementsService,
  ) {}

  async listOwn(
    principal: Principal,
    query: ServiceAgreementListQuery,
  ): Promise<ServiceAgreementClientPage> {
    const accountId = await this.accountOf(principal);
    const { rows, nextCursor } = await this.agreements.listForAccount(accountId, query);
    return { items: rows.map(toAgreementClientView), nextCursor };
  }

  async getOwn(principal: Principal, id: string): Promise<ServiceAgreementClientView> {
    const accountId = await this.accountOf(principal);
    return toAgreementClientView(await this.requireOwn(id, accountId));
  }

  async accept(principal: Principal, id: string): Promise<ServiceAgreementClientView> {
    const accountId = await this.accountOf(principal);
    const clientUserId = this.clientUserId(principal);
    const row = await this.requireOwn(id, accountId);
    await this.service.accept(row, clientUserId);
    return toAgreementClientView(await this.requireOwn(id, accountId));
  }

  private async requireOwn(id: string, accountId: string): Promise<AgreementRow> {
    const row = await this.agreements.findByIdForAccount(id, accountId);
    if (!row) throw errors.notFound();
    return row;
  }

  /** The client's account, resolved from their contact row; any non-client principal is absence (404). */
  private async accountOf(principal: Principal): Promise<string> {
    const accountId = await this.agreements.accountIdForUser(this.clientUserId(principal));
    if (!accountId) throw errors.notFound();
    return accountId;
  }

  private clientUserId(principal: Principal): string {
    if (principal.type !== "client") throw errors.notFound();
    return principal.userId;
  }
}
