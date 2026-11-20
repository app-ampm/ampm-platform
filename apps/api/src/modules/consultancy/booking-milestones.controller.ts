import { Controller, Get, HttpCode, Patch, Post, Req } from "@nestjs/common";
import {
  bookingMilestoneCreateRequest,
  errors,
  bookingMilestoneListQuery,
  bookingMilestoneTransitionRequest,
  bookingMilestoneUpdateRequest,
  uuid,
  type BookingMilestoneCreateRequest,
  type BookingMilestoneListQuery,
  type BookingMilestoneStaffPage,
  type BookingMilestoneStaffView,
  type BookingMilestoneTransitionRequest,
  type BookingMilestoneUpdateRequest,
  type DocumentLinkView,
} from "@ampm/core";
import type { Request } from "express";
import { z } from "zod";

import { RateLimit } from "../../common/rate-limit/rate-limit.decorator.js";
import { UPLOADS } from "../../common/rate-limit/route-limits.js";
import type { Access } from "../../common/request-context.js";
import { ZodBody, ZodParams, ZodQuery } from "../../common/zod.js";
import {
  CurrentAccess,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { BookingMilestonesService } from "./booking-milestones.service.js";
import { MilestoneContractService } from "./milestone-contract.service.js";

const milestoneParam = z.object({ milestoneId: uuid });

/**
 * The Hotel-team booking-milestone workspace (feature 10.5), keyed on `consultancy.booking_milestones.*`
 * and scoped through `@CurrentAccess` (SA/HT CRU, PM(a), FA RU, SM read; no delete). Writes self-audit
 * inside their service transaction. The status route marks a milestone done (recording a payment) or
 * cancels it; `overdue` is reached by the worker sweep, not a manual move. A `contract_signed` milestone
 * takes its signed contract as raw bytes (`POST …/contract`, update) and mints a 15-minute link to it
 * (`POST …/contract/link`, read — a POST because it writes a `document_access_links` row) (D-132).
 */
@Controller("consultancy-admin")
export class BookingMilestonesController {
  constructor(
    private readonly milestones: BookingMilestonesService,
    private readonly contracts: MilestoneContractService,
  ) {}

  @Get("booking-milestones")
  @RequirePermission("consultancy.booking_milestones.read")
  list(
    @ZodQuery(bookingMilestoneListQuery) query: BookingMilestoneListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffPage> {
    return this.milestones.list(principal, access, query);
  }

  @Get("booking-milestones/:milestoneId")
  @RequirePermission("consultancy.booking_milestones.read")
  get(
    @ZodParams(milestoneParam) params: { milestoneId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffView> {
    return this.milestones.get(principal, access, params.milestoneId);
  }

  @Post("booking-milestones")
  @HttpCode(201)
  @RequirePermission("consultancy.booking_milestones.create")
  @SelfAudited()
  create(
    @ZodBody(bookingMilestoneCreateRequest) body: BookingMilestoneCreateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffView> {
    return this.milestones.create(principal, access, body);
  }

  @Patch("booking-milestones/:milestoneId")
  @RequirePermission("consultancy.booking_milestones.update")
  @SelfAudited()
  update(
    @ZodParams(milestoneParam) params: { milestoneId: string },
    @ZodBody(bookingMilestoneUpdateRequest) body: BookingMilestoneUpdateRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffView> {
    return this.milestones.update(principal, access, params.milestoneId, body);
  }

  @Patch("booking-milestones/:milestoneId/status")
  @RequirePermission("consultancy.booking_milestones.update")
  @SelfAudited()
  transition(
    @ZodParams(milestoneParam) params: { milestoneId: string },
    @ZodBody(bookingMilestoneTransitionRequest) body: BookingMilestoneTransitionRequest,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffView> {
    return this.milestones.transition(principal, access, params.milestoneId, body);
  }

  // The raw file bytes are the request body (application/octet-stream); content, not extension, decides type.
  @Post("booking-milestones/:milestoneId/contract")
  @HttpCode(200)
  @RequirePermission("consultancy.booking_milestones.update")
  @RateLimit(UPLOADS)
  @SelfAudited()
  attachContract(
    @ZodParams(milestoneParam) params: { milestoneId: string },
    @Req() req: Request,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<BookingMilestoneStaffView> {
    if (!Buffer.isBuffer(req.body)) {
      throw errors.validation(
        [],
        "Send the raw file bytes as the request body (application/octet-stream)",
      );
    }
    return this.contracts.attach(principal, access, params.milestoneId, req.body);
  }

  @Post("booking-milestones/:milestoneId/contract/link")
  @HttpCode(201)
  @RequirePermission("consultancy.booking_milestones.read")
  @SelfAudited()
  contractLink(
    @ZodParams(milestoneParam) params: { milestoneId: string },
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<DocumentLinkView> {
    return this.contracts.link(principal, access, params.milestoneId);
  }
}
