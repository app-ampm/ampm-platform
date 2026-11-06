import { Injectable } from "@nestjs/common";
import {
  errors,
  type SiteVisitCreateRequest,
  type SiteVisitListQuery,
  type SiteVisitStaffPage,
  type SiteVisitStaffView,
  type SiteVisitTransitionRequest,
  type SiteVisitUpdateRequest,
} from "@ampm/core";
import { canTransition } from "@ampm/policy";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { recordScope } from "../../db/scoping.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";
import { Prisma } from "../../generated/prisma/client.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import { staffId } from "./enquiries.helpers.js";
import { isEnquiryTransitionDefined } from "./enquiry-status.js";
import {
  type SiteVisitEditPatch,
  type SiteVisitRow,
  SiteVisitsRepository,
} from "./site-visits.repository.js";
import { toSiteVisitStaffView } from "./site-visits.view.js";
import { isTerminalVisit, isVisitTransitionAllowed } from "./site-visit-status.js";

/**
 * The Hotel-team site-visit workspace (feature 10.3, AC-05.5), keyed on `consultancy.site_visits.*` and
 * scoped through `@CurrentAccess`. Scheduling a visit reads its enquiry in the same scope (404 if out of
 * reach), creates the visit, and best-effort advances the enquiry to `visit_scheduled` through the 10.1
 * machine (only when that move is defined and this actor may make it). The status machine is hand-rolled
 * (site-visit-status.ts); every write audits, and status moves are a compare-and-swap.
 */
@Injectable()
export class SiteVisitsService {
  constructor(
    private readonly visits: SiteVisitsRepository,
    private readonly enquiriesRepo: EnquiriesRepository,
    private readonly enquiries: EnquiriesService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: SiteVisitListQuery,
  ): Promise<SiteVisitStaffPage> {
    const { rows, nextCursor } = await this.visits.listStaff(
      this.visitScope(principal, access),
      query,
    );
    return { items: rows.map(toSiteVisitStaffView), nextCursor };
  }

  async get(principal: Principal, access: Access, id: string): Promise<SiteVisitStaffView> {
    return toSiteVisitStaffView(await this.requireInScope(id, principal, access));
  }

  async create(
    principal: Principal,
    access: Access,
    request: SiteVisitCreateRequest,
  ): Promise<SiteVisitStaffView> {
    const enquiry = await this.requireEnquiryInScope(request.enquiryId, principal, access);
    const actorId = staffId(principal);
    const visit = await this.prisma.$transaction(async (tx) => {
      const created = await this.visits.create(
        {
          enquiryId: enquiry.id,
          hotelId: enquiry.hotelId, // the enquiry's hotel, never taken from the request
          scheduledAt: new Date(request.scheduledAt),
          attendeesText: request.attendeesText,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "create",
          entityType: "site_visit",
          entityId: created.id,
          after: { enquiryId: enquiry.id, scheduledAt: created.scheduledAt.toISOString() },
          maskImages: false,
        },
        tx,
      );
      return created;
    });
    await this.advanceEnquiry(principal, access, enquiry);
    return toSiteVisitStaffView(visit);
  }

  async update(
    principal: Principal,
    access: Access,
    id: string,
    request: SiteVisitUpdateRequest,
  ): Promise<SiteVisitStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (isTerminalVisit(current.status)) {
      throw errors.conflict(`A ${current.status} visit is read-only`);
    }
    const actorId = staffId(principal);
    const patch = buildEditPatch(request);
    await this.prisma.$transaction(async (tx) => {
      assertVisitChanged(await this.visits.update(id, current.status, patch, actorId, tx));
      await this.audit.record(
        {
          action: "update",
          entityType: "site_visit",
          entityId: id,
          // Every editable field, incl. the RESTRICTED-NOTES outcome (§9 audit is internal-only).
          ...editAuditImage(current, patch),
          maskImages: false,
        },
        tx,
      );
    });
    return toSiteVisitStaffView(await this.requireInScope(id, principal, access));
  }

  async transition(
    principal: Principal,
    access: Access,
    id: string,
    request: SiteVisitTransitionRequest,
  ): Promise<SiteVisitStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (isTerminalVisit(current.status)) {
      throw errors.conflict(`A ${current.status} visit is read-only`);
    }
    if (!isVisitTransitionAllowed(current.status, request.status)) {
      throw errors.conflict(`A visit cannot move from ${current.status} to ${request.status}`);
    }
    const actorId = staffId(principal);
    await this.prisma.$transaction(async (tx) => {
      assertVisitChanged(
        await this.visits.updateStatus(id, current.status, request.status, actorId, tx),
      );
      await this.audit.record(
        {
          action: "update",
          entityType: "site_visit",
          entityId: id,
          before: { status: current.status },
          after: { status: request.status },
          maskImages: false,
        },
        tx,
      );
    });
    return toSiteVisitStaffView(await this.requireInScope(id, principal, access));
  }

  /**
   * Best-effort: move the enquiry to `visit_scheduled` when a visit is scheduled. A no-op when the
   * enquiry is already there, the move is undefined (e.g. still `submitted`), or this actor is not a
   * `→visit_scheduled` mover (SA may schedule a visit but is not a listed mover) — so it is pre-checked
   * and never 409s/403s; a rare concurrent change is logged, never a failure of the created visit.
   */
  private async advanceEnquiry(
    principal: Principal,
    access: Access,
    enquiry: EnquiryRow,
  ): Promise<void> {
    const to = "visit_scheduled" as const;
    if (enquiry.status === to || !isEnquiryTransitionDefined(enquiry.status, to)) return;
    const context = {
      projectId: enquiry.projectId ?? undefined,
      accountId: enquiry.accountId,
      assigneeId: enquiry.assignedUserId ?? undefined,
      requesterId: enquiry.requestedByUserId,
    };
    if (
      !canTransition(toPolicyPrincipal(principal), "hotel_enquiry", enquiry.status, to, context)
    ) {
      return;
    }
    await this.enquiries
      .transition(principal, access, enquiry.id, { status: to, outcome: null, summary: null })
      .catch(() =>
        this.logger.warn("consultancy.visit.enquiry_advance_failed", { enquiryId: enquiry.id }),
      );
  }

  /** The acting staff's scope over site visits, built from the guard's decision; an `assigned`-scope
   *  principal (PM) reaches only visits whose enquiry is in their projects (via the enquiry relation,
   *  since site_visits carries no project_id). SA/SM/HT read all; FA has no grant and never gets here. */
  private visitScope(principal: Principal, access: Access): Prisma.SiteVisitWhereInput {
    if (access.scope === "assigned" && principal.type === "staff") {
      const projectIds = principal.memberships.map((membership) => membership.projectId);
      return { deletedAt: null, enquiry: { projectId: { in: projectIds } } };
    }
    return { deletedAt: null };
  }

  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<SiteVisitRow> {
    const row = await this.visits.findByIdInScope(id, this.visitScope(principal, access));
    if (!row) throw errors.notFound();
    return row;
  }

  /** The enquiry a visit is scheduled for, within the staff's enquiry scope; 404 if out of reach. */
  private async requireEnquiryInScope(
    enquiryId: string,
    principal: Principal,
    access: Access,
  ): Promise<EnquiryRow> {
    const scope = recordScope(principal, access.scope);
    const row = await this.enquiriesRepo.findByIdInScope(enquiryId, scope.where);
    if (!row) throw errors.notFound();
    return row;
  }
}

/** Throws a conflict when a compare-and-swap write changed no rows (the visit moved underneath us). */
function assertVisitChanged(changed: number): void {
  if (changed === 0) {
    throw errors.conflict("The visit changed while you were working on it; reload and try again");
  }
}

/** The §9 before/after image of a visit edit — every editable field, incl. the RESTRICTED-NOTES outcome. */
function editAuditImage(current: SiteVisitRow, patch: SiteVisitEditPatch) {
  return {
    before: {
      scheduledAt: current.scheduledAt.toISOString(),
      attendeesText: current.attendeesText,
      outcomeInternal: current.outcomeInternal,
    },
    after: {
      scheduledAt: patch.scheduledAt
        ? patch.scheduledAt.toISOString()
        : current.scheduledAt.toISOString(),
      attendeesText:
        patch.attendeesText !== undefined ? patch.attendeesText : current.attendeesText,
      outcomeInternal:
        patch.outcomeInternal !== undefined ? patch.outcomeInternal : current.outcomeInternal,
    },
  };
}

/** The defined fields of a visit edit, so an omitted field is left untouched. */
function buildEditPatch(request: SiteVisitUpdateRequest): SiteVisitEditPatch {
  const patch: {
    scheduledAt?: Date;
    attendeesText?: SiteVisitEditPatch["attendeesText"];
    outcomeInternal?: SiteVisitEditPatch["outcomeInternal"];
  } = {};
  if (request.scheduledAt !== undefined) patch.scheduledAt = new Date(request.scheduledAt);
  if (request.attendeesText !== undefined) patch.attendeesText = request.attendeesText;
  if (request.outcomeInternal !== undefined) patch.outcomeInternal = request.outcomeInternal;
  return patch;
}
