import { uuid } from "@ampm/core";
import { z } from "zod";

import { defineEvent } from "../../../jobs/event-bus.js";
import { defineJob } from "../../../jobs/job.types.js";

/**
 * The P-7 demo-assistance reaction. Module D (consultancy) emits the event when a demo prospect requests
 * hotel assistance; Module B (CRM) reacts by enqueuing the durable job — logging a `demo` lead activity on
 * the originating lead and notifying its owner, never creating an enquiry (AC-03.4). The event + job live
 * in CRM so the emitter (D) imports them downward (D → B); dependencies never point upward (api.md). The
 * durable write runs in the job (retryable + idempotent, jobs rule), not inline in the bus handler.
 */
const demoRequestPayload = z.object({
  /** The demo prospect's own client account (resolved server-side, never from the request). */
  accountId: uuid,
  /** The hotel the prospect asked about. */
  hotelId: uuid,
  /** The demo user who made the request, recorded as the activity's actor. */
  demoUserId: uuid,
  /** The prospect's own request text (their note), carried onto the lead activity (AC-03.4). */
  requestNote: z.string().nullable(),
});

export type HotelAssistanceDemoRequested = z.infer<typeof demoRequestPayload>;

export const hotelAssistanceDemoRequested = defineEvent<HotelAssistanceDemoRequested>(
  "hotel_assistance.demo_requested",
);

export const hotelAssistanceDemoJob = defineJob("crm.hotel_assistance_demo", demoRequestPayload);
