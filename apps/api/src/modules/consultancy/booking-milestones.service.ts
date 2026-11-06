import { Injectable } from "@nestjs/common";
import {
  errors,
  type BookingMilestoneCreateRequest,
  type BookingMilestoneListQuery,
  type BookingMilestoneStaffPage,
  type BookingMilestoneStaffView,
  type BookingMilestoneTransitionRequest,
  type BookingMilestoneUpdateRequest,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { recordScope } from "../../db/scoping.js";
import { EventBus } from "../../jobs/event-bus.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { milestonePaid } from "./booking-milestones.events.js";
import {
  assertMilestoneChanged,
  buildMilestoneEditPatch,
  buildMilestoneWrite,
  editMilestoneAuditImage,
  emitMilestoneEvent,
  isPaymentMilestone,
  milestoneScope,
} from "./booking-milestones.helpers.js";
import {
  BookingMilestonesRepository,
  type BookingMilestoneRow,
} from "./booking-milestones.repository.js";
import { toBookingMilestoneStaffView } from "./booking-milestones.view.js";
import { isMilestoneTransitionAllowed, isTerminalMilestone } from "./booking-milestone-status.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { staffId } from "./enquiries.helpers.js";

type Tx = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

/**
 * The Hotel-team booking-milestone workspace (feature 10.5), keyed on `consultancy.booking_milestones.*`
 * and scoped through `@CurrentAccess` (SA/HT CRU, PM(a), FA RU for amounts + payment status, SM read). The
 * status machine is hand-rolled (booking-milestone-status.ts); every write audits and status moves are a
 * compare-and-swap. Completing a payment milestone emits a handler-less `paid` event (payments are offline
 * bank transfer in v1 — recorded, not collected). The staff always see the amount; the client's W-14
 * gating lives in the client service.
 */
@Injectable()
export class BookingMilestonesService {
  constructor(
    private readonly milestones: BookingMilestonesRepository,
    private readonly enquiriesRepo: EnquiriesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: EventBus,
    private readonly logger: AppLogger,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: BookingMilestoneListQuery,
  ): Promise<BookingMilestoneStaffPage> {
    const { rows, nextCursor } = await this.milestones.listStaff(
      milestoneScope(principal, access),
      query,
    );
    return { items: rows.map(toBookingMilestoneStaffView), nextCursor };
  }

  async get(principal: Principal, access: Access, id: string): Promise<BookingMilestoneStaffView> {
    return toBookingMilestoneStaffView(await this.requireInScope(id, principal, access));
  }

  async create(
    principal: Principal,
    access: Access,
    request: BookingMilestoneCreateRequest,
  ): Promise<BookingMilestoneStaffView> {
    const enquiry = await this.requireEnquiryInScope(request.enquiryId, principal, access);
    const actorId = staffId(principal);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await this.milestones.create(buildMilestoneWrite(request, enquiry), actorId, tx);
      await this.auditMilestone(
        tx,
        "create",
        row.id,
        {},
        { enquiryId: enquiry.id, milestoneType: row.milestoneType, status: row.status },
      );
      return row;
    });
    return toBookingMilestoneStaffView(created);
  }

  async update(
    principal: Principal,
    access: Access,
    id: string,
    request: BookingMilestoneUpdateRequest,
  ): Promise<BookingMilestoneStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (isTerminalMilestone(current.status)) {
      throw errors.conflict(`A ${current.status} milestone is read-only`);
    }
    const actorId = staffId(principal);
    const patch = buildMilestoneEditPatch(request);
    const image = editMilestoneAuditImage(current, patch);
    await this.prisma.$transaction(async (tx) => {
      assertMilestoneChanged(await this.milestones.update(id, current.status, patch, actorId, tx));
      await this.auditMilestone(tx, "update", id, image.before, image.after);
    });
    return toBookingMilestoneStaffView(await this.requireInScope(id, principal, access));
  }

  async transition(
    principal: Principal,
    access: Access,
    id: string,
    request: BookingMilestoneTransitionRequest,
  ): Promise<BookingMilestoneStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (isTerminalMilestone(current.status)) {
      throw errors.conflict(`A ${current.status} milestone is read-only`);
    }
    if (!isMilestoneTransitionAllowed(current.status, request.status)) {
      throw errors.conflict(`A milestone cannot move from ${current.status} to ${request.status}`);
    }
    const actorId = staffId(principal);
    const patch =
      request.status === "done"
        ? { status: request.status, completedAt: new Date() }
        : { status: request.status };
    await this.prisma.$transaction(async (tx) => {
      assertMilestoneChanged(
        await this.milestones.updateStatus(id, current.status, patch, actorId, tx),
      );
      await this.auditMilestone(
        tx,
        "update",
        id,
        { status: current.status },
        { status: request.status },
      );
    });
    const row = await this.requireInScope(id, principal, access);
    if (request.status === "done" && isPaymentMilestone(row.milestoneType)) {
      await emitMilestoneEvent(this.bus, this.logger, milestonePaid, row);
    }
    return toBookingMilestoneStaffView(row);
  }

  private async auditMilestone(
    tx: Tx,
    action: "create" | "update",
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record(
      { action, entityType: "booking_milestone", entityId, before, after, maskImages: false },
      tx,
    );
  }

  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<BookingMilestoneRow> {
    const row = await this.milestones.findByIdInScope(id, milestoneScope(principal, access));
    if (!row) throw errors.notFound();
    return row;
  }

  private async requireEnquiryInScope(
    enquiryId: string,
    principal: Principal,
    access: Access,
  ): Promise<EnquiryRow> {
    const row = await this.enquiriesRepo.findByIdInScope(
      enquiryId,
      recordScope(principal, access.scope).where,
    );
    if (!row) throw errors.notFound();
    return row;
  }
}
