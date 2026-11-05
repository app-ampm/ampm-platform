import { Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  hotelProposalCreateRequest,
  hotelProposalListQuery,
  hotelProposalUpdateRequest,
  uuid,
  type HotelProposalCreateRequest,
  type HotelProposalInternalPage,
  type HotelProposalInternalView,
  type HotelProposalListQuery,
  type HotelProposalUpdateRequest,
} from "@ampm/core";
import { z } from "zod";

import type { Access } from "../../common/request-context.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  CurrentAccess,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { ProposalsService } from "./proposals.service.js";

const proposalParam = z.object({ proposalId: uuid });

/**
 * The Hotel-team proposal workspace (feature 10.4), keyed on `consultancy.proposals.*` and scoped
 * through `@CurrentAccess`. Create/edit are draft-only (share creates the version lock); `share` and the
 * revision both self-audit in their service transaction. The internal total + margin are serialised only
 * for a reader holding `read_internal_amount` (SA/HT/FA, PM assigned) — SM sees the proposal without them.
 */
@Controller("consultancy-admin")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get("proposals")
  @RequirePermission("consultancy.proposals.read")
  list(
    @ZodQuery(hotelProposalListQuery) query: HotelProposalListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalPage> {
    return this.proposals.list(principal, access, query);
  }

  @Get("proposals/:proposalId")
  @RequirePermission("consultancy.proposals.read")
  get(
    @ZodParams(proposalParam) params: { proposalId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalView> {
    return this.proposals.get(principal, access, params.proposalId);
  }

  @Post("proposals")
  @HttpCode(201)
  @RequirePermission("consultancy.proposals.create")
  @SelfAudited()
  create(
    @ZodBody(hotelProposalCreateRequest) body: HotelProposalCreateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalView> {
    return this.proposals.create(principal, access, body);
  }

  @Patch("proposals/:proposalId")
  @RequirePermission("consultancy.proposals.update")
  @SelfAudited()
  update(
    @ZodParams(proposalParam) params: { proposalId: string },
    @ZodBody(hotelProposalUpdateRequest) body: HotelProposalUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalView> {
    return this.proposals.update(principal, access, params.proposalId, body);
  }

  @Post("proposals/:proposalId/share")
  @HttpCode(200)
  @RequirePermission("consultancy.proposals.share")
  @SelfAudited()
  share(
    @ZodParams(proposalParam) params: { proposalId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalView> {
    return this.proposals.share(principal, access, params.proposalId);
  }

  @Post("proposals/:proposalId/revise")
  @HttpCode(201)
  @RequirePermission("consultancy.proposals.create")
  @SelfAudited()
  revise(
    @ZodParams(proposalParam) params: { proposalId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<HotelProposalInternalView> {
    return this.proposals.revise(principal, access, params.proposalId);
  }
}
