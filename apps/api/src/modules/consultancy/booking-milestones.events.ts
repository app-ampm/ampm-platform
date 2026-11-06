import { bookingMilestoneType, uuid } from "@ampm/core";
import { z } from "zod";

import { defineEvent } from "../../jobs/event-bus.js";

/**
 * Handler-less consultancy booking-milestone events (feature 10.5), mirroring the 10.4 proposal events:
 * `emit` with no registered listener is a no-op, so the seam is real and Module E/F/reporting can
 * `bus.on(...)` later. `due` fires when the overdue sweep surfaces a past-due milestone; `paid` fires when
 * a payment milestone is recorded done (payments are offline bank transfer in v1 — recorded, not collected).
 */
export const milestoneEventPayload = z.object({
  milestoneId: uuid,
  enquiryId: uuid,
  milestoneType: bookingMilestoneType,
});
export type MilestoneEvent = z.infer<typeof milestoneEventPayload>;

export const milestoneDue = defineEvent<MilestoneEvent>("consultancy.booking_milestone.due");
export const milestonePaid = defineEvent<MilestoneEvent>("consultancy.booking_milestone.paid");
