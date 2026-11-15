import {
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

/** The stages the team still works on (an outcome — confirmed or closed — is no longer "open"). */
const OPEN_STAGES: readonly HotelEnquiryStage[] = [
  "new",
  "with_hotel",
  "proposal",
  "client_decision",
];

/**
 * The pipeline view: each stage's count, summed from the per-status counts in scope, and the open
 * enquiries nobody holds. Pure folding over the insights repository's two counts.
 */
export async function pipelineView(
  insights: EnquiryInsightsRepository,
  scopeWhere: Prisma.HotelEnquiryWhereInput,
): Promise<HotelEnquiryPipelineView> {
  const openStatuses = OPEN_STAGES.flatMap((stage) => HOTEL_ENQUIRY_STAGE_STATUSES[stage]);
  const [byStatus, unassignedOpen] = await Promise.all([
    insights.countByStatus(scopeWhere),
    insights.countUnassigned(scopeWhere, openStatuses),
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
  return { stages, unassignedOpen };
}

/**
 * The staff pipeline's counts (`GET /consultancy-admin/enquiries/pipeline`), over the same scope as the
 * staff queue (`recordScope`): what the queue's stage filter shows beside each stage.
 */
@Injectable()
export class EnquiryPipelineService {
  constructor(private readonly insights: EnquiryInsightsRepository) {}

  async pipeline(principal: Principal, access: Access): Promise<HotelEnquiryPipelineView> {
    return pipelineView(this.insights, recordScope(principal, access.scope).where);
  }
}
