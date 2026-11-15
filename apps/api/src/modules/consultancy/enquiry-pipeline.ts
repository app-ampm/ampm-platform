import {
  HOTEL_ENQUIRY_OPEN_STATUSES,
  HOTEL_ENQUIRY_STAGE_STATUSES,
  type HotelEnquiryPipelineView,
  type HotelEnquiryStage,
} from "@ampm/core";

import { Injectable } from "@nestjs/common";

import type { Access } from "../../common/request-context.js";
import { recordScope } from "../../db/scoping.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiryInsightsRepository } from "./enquiry-insights.repository.js";

/**
 * The pipeline view: each stage's count, summed from the per-status counts in scope, the open enquiries
 * nobody holds, and the open ones the reader holds (none for a reader with no user id). Pure folding over
 * the insights repository's counts.
 */
export async function pipelineView(
  insights: EnquiryInsightsRepository,
  scopeWhere: Prisma.HotelEnquiryWhereInput,
  readerId: string | null,
): Promise<HotelEnquiryPipelineView> {
  const open = HOTEL_ENQUIRY_OPEN_STATUSES;
  const [byStatus, unassignedOpen, mineOpen] = await Promise.all([
    insights.countByStatus(scopeWhere),
    insights.countOpenHeldBy(scopeWhere, null, open),
    readerId === null ? Promise.resolve(0) : insights.countOpenHeldBy(scopeWhere, readerId, open),
  ]);
  const count = (stage: HotelEnquiryStage): number =>
    HOTEL_ENQUIRY_STAGE_STATUSES[stage].reduce(
      (sum, status) => sum + (byStatus.get(status) ?? 0),
      0,
    );
  const stages: Record<HotelEnquiryStage, number> = {
    new: count("new"),
    with_hotel: count("with_hotel"),
    proposal: count("proposal"),
    client_decision: count("client_decision"),
    confirmed: count("confirmed"),
    closed: count("closed"),
  };
  return { stages, unassignedOpen, mineOpen };
}

/**
 * The staff pipeline's counts (`GET /consultancy-admin/enquiries/pipeline`), over the same scope as the
 * staff queue (`recordScope`): what the queue's stage filter shows beside each stage.
 */
@Injectable()
export class EnquiryPipelineService {
  constructor(private readonly insights: EnquiryInsightsRepository) {}

  async pipeline(principal: Principal, access: Access): Promise<HotelEnquiryPipelineView> {
    const readerId = principal.type === "system" ? null : principal.userId;
    return pipelineView(this.insights, recordScope(principal, access.scope).where, readerId);
  }
}
