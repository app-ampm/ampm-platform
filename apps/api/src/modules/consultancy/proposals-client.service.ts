import { Injectable } from "@nestjs/common";
import {
  errors,
  type HotelProposalClientPage,
  type HotelProposalClientView,
  type HotelProposalDecisionRequest,
  type HotelProposalListQuery,
} from "@ampm/core";

import { entitlementGate } from "../../policy/entitlement-gate.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesRepository } from "./enquiries.repository.js";
import { type ProposalRow, ProposalsRepository } from "./proposals.repository.js";
import { ProposalsService } from "./proposals.service.js";
import { toProposalClientView } from "./proposals.view.js";

/**
 * The client's window onto their enquiry's proposals (CP-10, AC-05.2): read the client total +
 * client-visible lines, and decide (accept / decline / request a revision). Gated on the
 * `hotel_assistance` entitlement (the enquiry-client pattern) and scoped to the caller's own account via
 * the enquiry — a proposal on another account's enquiry, or a draft AMPM has not shared, is absence
 * (404). The client only ever sees CLIENT fields (toProposalClientView); the internal total never loads.
 */
@Injectable()
export class ProposalsClientService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly enquiries: EnquiriesRepository,
    private readonly service: ProposalsService,
  ) {}

  async listForEnquiry(
    principal: Principal,
    enquiryId: string,
    query: HotelProposalListQuery,
  ): Promise<HotelProposalClientPage> {
    const { accountId } = await this.account(principal, false);
    await this.requireOwnEnquiry(enquiryId, accountId);
    const { rows, nextCursor } = await this.proposals.listForEnquiry(enquiryId, query);
    return { items: rows.map(toProposalClientView), nextCursor };
  }

  async getOwn(principal: Principal, id: string): Promise<HotelProposalClientView> {
    const { accountId } = await this.account(principal, false);
    return toProposalClientView(await this.requireOwnShared(id, accountId));
  }

  async decide(
    principal: Principal,
    id: string,
    request: HotelProposalDecisionRequest,
  ): Promise<HotelProposalClientView> {
    const { userId, accountId } = await this.account(principal, true);
    const proposal = await this.requireOwnShared(id, accountId);
    await this.service.decide(proposal, userId, accountId, request.decision);
    return toProposalClientView(await this.requireOwnShared(id, accountId));
  }

  /** The proposal must exist, belong to the caller's account (via its enquiry), and not be a draft
   *  (drafts are AMPM-internal) — otherwise absence (404). */
  private async requireOwnShared(id: string, accountId: string): Promise<ProposalRow> {
    const row = await this.proposals.findById(id);
    if (!row || row.status === "draft") throw errors.notFound();
    await this.requireOwnEnquiry(row.enquiryId, accountId);
    return row;
  }

  private async requireOwnEnquiry(enquiryId: string, accountId: string): Promise<void> {
    const enquiry = await this.enquiries.findByIdForAccount(enquiryId, accountId);
    if (!enquiry) throw errors.notFound();
  }

  private async account(
    principal: Principal,
    needWrite: boolean,
  ): Promise<{ userId: string; accountId: string }> {
    const { userId } = entitlementGate(principal, "hotel_assistance", needWrite);
    const accountId = await this.enquiries.accountIdForUser(userId);
    if (!accountId) throw errors.notFound();
    return { userId, accountId };
  }
}
