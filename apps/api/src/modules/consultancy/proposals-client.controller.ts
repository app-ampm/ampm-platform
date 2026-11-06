import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  hotelProposalDecisionRequest,
  hotelProposalListQuery,
  uuid,
  type HotelProposalClientPage,
  type HotelProposalClientView,
  type HotelProposalDecisionRequest,
  type HotelProposalListQuery,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import { CurrentPrincipal, SelfAudited } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { ProposalsClientService } from "./proposals-client.service.js";

const enquiryParam = z.object({ enquiryId: uuid });

/**
 * The client/demo side of hotel proposals (CP-10, AC-05.2): authenticated but not permission-keyed — the
 * service gates on the `hotel_assistance` entitlement and scopes to the caller's own account through the
 * enquiry, answering 404 to everyone else (and to a not-yet-shared draft). The decision writes a status
 * change, so it self-audits in the shared transition's transaction; the reads carry CLIENT fields only.
 */
@Controller("consultancy")
export class ProposalsClientController {
  constructor(private readonly proposals: ProposalsClientService) {}

  @Get("enquiries/:enquiryId/proposals")
  list(
    @ZodParams(enquiryParam) params: { enquiryId: string },
    @ZodQuery(hotelProposalListQuery) query: HotelProposalListQuery,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelProposalClientPage> {
    return this.proposals.listForEnquiry(principal, params.enquiryId, query);
  }

  @Get("proposals/:proposalId")
  get(
    @ZodParams(z.object({ proposalId: uuid })) params: { proposalId: string },
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelProposalClientView> {
    return this.proposals.getOwn(principal, params.proposalId);
  }

  @Post("proposals/:proposalId/decision")
  @HttpCode(200)
  @SelfAudited()
  decide(
    @ZodParams(z.object({ proposalId: uuid })) params: { proposalId: string },
    @ZodBody(hotelProposalDecisionRequest) body: HotelProposalDecisionRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HotelProposalClientView> {
    return this.proposals.decide(principal, params.proposalId, body);
  }
}
