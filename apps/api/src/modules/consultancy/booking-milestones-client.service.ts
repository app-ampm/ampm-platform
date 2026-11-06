import { Injectable } from "@nestjs/common";
import {
  errors,
  type BookingMilestoneClientPage,
  type BookingMilestoneClientView,
  type BookingMilestoneListQuery,
} from "@ampm/core";

import { ConfigService } from "../admin/config/config.service.js";
import { entitlementGate } from "../../policy/entitlement-gate.js";
import type { Principal } from "../../policy/principal.types.js";
import { toBookingMilestoneClientView } from "./booking-milestones.view.js";
import { BookingMilestonesRepository } from "./booking-milestones.repository.js";
import { EnquiriesRepository } from "./enquiries.repository.js";

/**
 * The client's window onto their enquiry's booking milestones (CP Booking tab): read-only. Gated on the
 * `hotel_assistance` entitlement (the 10.1 enquiry-client pattern) and scoped to the caller's own account
 * via the enquiry — a milestone on another account's enquiry is absence (404). The amount is shown only
 * where the W-14 config flag is on (toBookingMilestoneClientView); internal references never reach a client.
 */
@Injectable()
export class BookingMilestonesClientService {
  constructor(
    private readonly milestones: BookingMilestonesRepository,
    private readonly enquiries: EnquiriesRepository,
    private readonly config: ConfigService,
  ) {}

  async listForEnquiry(
    principal: Principal,
    enquiryId: string,
    query: BookingMilestoneListQuery,
  ): Promise<BookingMilestoneClientPage> {
    const accountId = await this.accountOf(principal);
    await this.requireOwnEnquiry(enquiryId, accountId);
    const amountsVisible = await this.amountsVisible();
    const { rows, nextCursor } = await this.milestones.listForEnquiry(enquiryId, query);
    return {
      items: rows.map((row) => toBookingMilestoneClientView(row, amountsVisible)),
      nextCursor,
    };
  }

  async get(principal: Principal, milestoneId: string): Promise<BookingMilestoneClientView> {
    const accountId = await this.accountOf(principal);
    const row = await this.milestones.findById(milestoneId);
    if (!row) throw errors.notFound();
    await this.requireOwnEnquiry(row.enquiryId, accountId);
    return toBookingMilestoneClientView(row, await this.amountsVisible());
  }

  private async amountsVisible(): Promise<boolean> {
    const { milestoneAmountsVisible } = await this.config.get(
      "consultancy.milestone_amounts_visible",
    );
    return milestoneAmountsVisible;
  }

  /** The enquiry must exist and belong to the caller's account; otherwise absence (404). */
  private async requireOwnEnquiry(enquiryId: string, accountId: string): Promise<void> {
    const enquiry = await this.enquiries.findByIdForAccount(enquiryId, accountId);
    if (!enquiry) throw errors.notFound();
  }

  private async accountOf(principal: Principal): Promise<string> {
    const { userId } = entitlementGate(principal, "hotel_assistance", false);
    const accountId = await this.enquiries.accountIdForUser(userId);
    if (!accountId) throw errors.notFound();
    return accountId;
  }
}
