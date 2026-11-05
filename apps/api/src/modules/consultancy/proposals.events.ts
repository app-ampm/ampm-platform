import { uuid } from "@ampm/core";
import { z } from "zod";

import { defineEvent } from "../../jobs/event-bus.js";

/**
 * Module D consultancy proposal domain events (architecture §6/§9 — cross-module reactions go through
 * domain events on the worker, never a direct upward call). ProposalsService emits them after the
 * status transaction commits. No handler is registered in 10.4: emit with no listeners is a no-op
 * (event-bus.ts), so the seam is real and Module E/G/reporting can `bus.on(...)` later without D calling
 * upward. Same-module reactions (the client notice, advancing the enquiry) stay DIRECT service calls.
 * The `proposal.expired` event + its reminder job are deferred (the status enum has no `expired` value
 * and the table has no reminded-at marker; the read-time expiry guard covers the only 10.4 AC).
 */
export const proposalEventPayload = z.object({
  proposalId: uuid,
  enquiryId: uuid,
  accountId: uuid,
  hotelId: uuid,
  versionNumber: z.number().int().positive(),
});
export type ProposalEvent = z.infer<typeof proposalEventPayload>;

export const proposalShared = defineEvent<ProposalEvent>("consultancy.proposal.shared");
export const proposalAccepted = defineEvent<ProposalEvent>("consultancy.proposal.accepted");
export const proposalDeclined = defineEvent<ProposalEvent>("consultancy.proposal.declined");
