import { Controller, Get } from "@nestjs/common";
import {
  bookingMilestoneListQuery,
  uuid,
  type BookingMilestoneClientPage,
  type BookingMilestoneClientView,
  type BookingMilestoneListQuery,
} from "@ampm/core";
import { z } from "zod";

import { ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { BookingMilestonesClientService } from "./booking-milestones-client.service.js";

const enquiryParam = z.object({ enquiryId: uuid });

/**
 * The client/demo side of booking milestones (CP Booking tab): authenticated but not permission-keyed —
 * the service gates on the `hotel_assistance` entitlement and scopes to the caller's own account through
 * the enquiry, answering 404 to everyone else (the enquiries-client pattern). Read-only; the amount is
 * present only where the W-14 config flag is on.
 */
@Controller("consultancy")
export class BookingMilestonesClientController {
  constructor(private readonly milestones: BookingMilestonesClientService) {}

  @Get("enquiries/:enquiryId/milestones")
  list(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodQuery(bookingMilestoneListQuery) query: BookingMilestoneListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<BookingMilestoneClientPage> {
    return this.milestones.listForEnquiry(principal, params.enquiryId, query);
  }

  @Get("milestones/:milestoneId")
  get(
    @ZodParams(z.object({ milestoneId: uuid })) params: { milestoneId: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<BookingMilestoneClientView> {
    return this.milestones.get(principal, params.milestoneId);
  }
}
