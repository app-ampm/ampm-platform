import { Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  bookingMilestoneCreateRequest,
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
import { BookingMilestonesService } from "./booking-milestones.service.js";

const milestoneParam = z.object({ milestoneId: uuid });

/**
 * The Hotel-team booking-milestone workspace (feature 10.5), keyed on `consultancy.booking_milestones.*`
 * and scoped through `@CurrentAccess` (SA/HT CRU, PM(a), FA RU, SM read; no delete). Writes self-audit
 * inside their service transaction. The status route marks a milestone done (recording a payment) or
 * cancels it; `overdue` is reached by the worker sweep, not a manual move.
 */
@Controller("consultancy-admin")
export class BookingMilestonesController {
  constructor(private readonly milestones: BookingMilestonesService) {}

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
}
