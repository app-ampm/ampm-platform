import { Injectable } from "@nestjs/common";
import {
  errors,
  type SiteVisitClientPage,
  type SiteVisitClientView,
  type SiteVisitFeedbackRequest,
  type SiteVisitListQuery,
} from "@ampm/core";

import { entitlementGate } from "../../policy/entitlement-gate.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesRepository } from "./enquiries.repository.js";
import { SiteVisitsRepository } from "./site-visits.repository.js";
import { toSiteVisitClientView } from "./site-visits.view.js";

/**
 * The client's window onto their enquiry's site visits (CP, AC-05.5): read date + status + own feedback,
 * and submit/update their own `client_feedback`. Gated on the `hotel_assistance` entitlement (the 10.1
 * enquiry-client pattern) and scoped to the caller's own account via the enquiry — a visit on another
 * account's enquiry is absence (404). The client only ever sees CLIENT fields (toSiteVisitClientView).
 */
@Injectable()
export class SiteVisitsClientService {
  constructor(
    private readonly visits: SiteVisitsRepository,
    private readonly enquiries: EnquiriesRepository,
  ) {}

  async listForEnquiry(
    principal: Principal,
    enquiryId: string,
    query: SiteVisitListQuery,
  ): Promise<SiteVisitClientPage> {
    const accountId = await this.accountOf(principal, false);
    await this.requireOwnEnquiry(enquiryId, accountId);
    const { rows, nextCursor } = await this.visits.listForEnquiry(enquiryId, query);
    return { items: rows.map(toSiteVisitClientView), nextCursor };
  }

  async updateFeedback(
    principal: Principal,
    visitId: string,
    request: SiteVisitFeedbackRequest,
  ): Promise<SiteVisitClientView> {
    const { userId, accountId } = await this.account(principal, true);
    const visit = await this.visits.findById(visitId);
    if (!visit) throw errors.notFound();
    await this.requireOwnEnquiry(visit.enquiryId, accountId);
    await this.visits.updateFeedback(visitId, request.clientFeedback, userId);
    const updated = await this.visits.findById(visitId);
    if (!updated) throw errors.notFound();
    return toSiteVisitClientView(updated);
  }

  /** The enquiry must exist and belong to the caller's account; otherwise absence (404). */
  private async requireOwnEnquiry(enquiryId: string, accountId: string): Promise<void> {
    const enquiry = await this.enquiries.findByIdForAccount(enquiryId, accountId);
    if (!enquiry) throw errors.notFound();
  }

  private async accountOf(principal: Principal, needWrite: boolean): Promise<string> {
    return (await this.account(principal, needWrite)).accountId;
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
