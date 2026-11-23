import { Injectable } from "@nestjs/common";
import {
  errors,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryEventCreateRequest,
  type HotelEnquiryEventView,
  type HotelEnquiryListQuery,
  type HotelEnquiryStaffDetailView,
  type HotelEnquiryStaffPage,
  type HotelEnquiryStaffUpdateRequest,
  type HotelEnquiryStaffView,
  type HotelEnquiryStatusUpdateRequest,
} from "@ampm/core";
import { can, canTransition, type TransitionContext } from "@ampm/policy";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { recordScope } from "../../db/scoping.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId, toPolicyPrincipal } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { ServiceAgreementsService } from "../crm/service-agreements/service-agreements.service.js";
import { assigneeWhere, EnquiryAssignmentService } from "./enquiry-assignment.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { BookingMilestonesRepository } from "./booking-milestones.repository.js";
import { EnquiryEventsRepository, type EnquiryEventRow } from "./enquiry-events.repository.js";
import { EnquiryInsightsRepository, NO_EXTRAS } from "./enquiry-insights.repository.js";
import { EnquiryTransitionWriter } from "./enquiry-transition-writer.js";
import {
  buildStaffPatch,
  buildStatusPatch,
  guardChargeableStage,
  guardConfirmedReady,
  isInherentlyInternalEvent,
} from "./enquiries.helpers.js";
import {
  toEnquiryClientDetailView,
  toEnquiryEventView,
  toEnquiryStaffDetailView,
  toEnquiryStaffView,
} from "./enquiries.view.js";
import {
  isClientVisibleStatus,
  isEnquiryTransitionDefined,
  isTerminalEnquiry,
} from "./enquiry-status.js";

const INTERNAL_NOTES_KEY = "consultancy.enquiry_notes.read";

/**
 * The Hotel-team enquiry workspace (TW-26, API-first). Reads and writes are permission-keyed and scoped
 * (findByIdInScope); the serialiser drops `notes_internal` + internal-only events for a reader without
 * `consultancy.enquiry_notes.read` (FA). Transitions run through `@ampm/policy` `canTransition`; a status
 * change writes an append-only event + an audit row in one transaction, then notifies the client (AC-05.3).
 */
@Injectable()
export class EnquiriesService {
  constructor(
    private readonly enquiries: EnquiriesRepository,
    private readonly events: EnquiryEventsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly writer: EnquiryTransitionWriter,
    private readonly config: ConfigService,
    private readonly agreements: ServiceAgreementsService,
    private readonly milestones: BookingMilestonesRepository,
    private readonly insights: EnquiryInsightsRepository,
    private readonly logger: AppLogger,
    private readonly assignment: EnquiryAssignmentService,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: HotelEnquiryListQuery,
  ): Promise<HotelEnquiryStaffPage> {
    const scope = recordScope(principal, access.scope);
    const withNotes = this.canReadInternalNotes(principal);
    const { rows, nextCursor } = await this.enquiries.listStaff(
      scope.where,
      query,
      assigneeWhere(query.assignee, principal),
    );
    const extras = await this.insights.extrasFor(rows);
    return {
      items: rows.map((row) => toEnquiryStaffView(row, withNotes, extras.get(row.id) ?? NO_EXTRAS)),
      nextCursor,
    };
  }

  async get(
    principal: Principal,
    access: Access,
    id: string,
  ): Promise<HotelEnquiryStaffDetailView> {
    const scope = recordScope(principal, access.scope);
    const row = await this.enquiries.findByIdInScope(id, scope.where);
    if (!row) throw errors.notFound();
    const [events, extras] = await Promise.all([
      this.events.listByEnquiry(row.id),
      this.insights.extrasOf(row),
    ]);
    return toEnquiryStaffDetailView(row, events, this.canReadInternalNotes(principal), extras);
  }

  /**
   * AC-05.4 "preview as client": a staff reader sees exactly the client serialisation of an enquiry,
   * byte-identical to the client's own GET, so the privacy boundary is verifiable. Same read permission
   * and scope as the staff detail; returns the CLIENT view (never the internal fields).
   */
  async previewAsClient(
    principal: Principal,
    access: Access,
    id: string,
  ): Promise<HotelEnquiryClientDetailView> {
    const row = await this.requireInScope(id, principal, access);
    const events = await this.events.listByEnquiry(row.id);
    return toEnquiryClientDetailView(row, events);
  }

  async transition(
    principal: Principal,
    access: Access,
    id: string,
    request: HotelEnquiryStatusUpdateRequest,
  ): Promise<HotelEnquiryStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (isTerminalEnquiry(current.status)) {
      throw errors.conflict(`A ${current.status} enquiry is read-only`);
    }
    const to = request.status;
    // Distinguish an illegal move (409) from one this principal may not make (403) — AC-31.1.
    if (!isEnquiryTransitionDefined(current.status, to)) {
      throw errors.conflict(`An enquiry cannot move from ${current.status} to ${to}`);
    }
    const context = this.transitionContext(current);
    if (
      !canTransition(toPolicyPrincipal(principal), "hotel_enquiry", current.status, to, context)
    ) {
      throw errors.forbidden(`You cannot move this enquiry from ${current.status} to ${to}`);
    }
    await guardChargeableStage(this.config, this.agreements, current.id, to);
    await guardConfirmedReady(this.milestones, current.id, to);
    const patch = buildStatusPatch(request, to);
    await this.writer.write(current, patch, to, request.summary, staffId(principal));
    if (isClientVisibleStatus(to)) {
      await this.writer
        .notifyClient(current.accountId, current.id)
        .catch(() =>
          this.logger.warn("consultancy.enquiry.notify_failed", { enquiryId: current.id }),
        );
    }
    return this.staffView(await this.requireInScope(id, principal, access), principal);
  }

  private transitionContext(current: EnquiryRow): TransitionContext {
    return {
      projectId: current.projectId ?? undefined,
      accountId: current.accountId,
      assigneeId: current.assignedUserId ?? undefined,
      requesterId: current.requestedByUserId,
    };
  }

  async addEvent(
    principal: Principal,
    access: Access,
    id: string,
    request: HotelEnquiryEventCreateRequest,
  ): Promise<HotelEnquiryEventView> {
    await this.requireInScope(id, principal, access);
    if (request.eventType === "submitted" || request.eventType === "status_change") {
      throw errors.validation([
        {
          path: "eventType",
          message: "That event type is recorded by the system, not added by hand",
        },
      ]);
    }
    if (request.documentId !== null) {
      // The documents service lands in feature 10.2; until then a supplied id would dangle — reject it.
      throw errors.validation([
        { path: "documentId", message: "Document attachments arrive in feature 10.2" },
      ]);
    }
    return toEnquiryEventView(await this.persistEvent(id, request, staffId(principal)));
  }

  private async persistEvent(
    id: string,
    request: HotelEnquiryEventCreateRequest,
    actorId: string,
  ): Promise<EnquiryEventRow> {
    return this.prisma.$transaction(async (tx) => {
      const created = await this.events.create(
        {
          enquiryId: id,
          eventType: request.eventType,
          occurredAt: new Date(),
          userId: actorId,
          summary: request.summary,
          // Fail closed: negotiation-bearing event types are internal regardless of the flag sent.
          internalOnly: isInherentlyInternalEvent(request.eventType) || request.internalOnly,
          documentId: null,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "create",
          entityType: "hotel_enquiry_event",
          entityId: created.id,
          after: {
            enquiryId: id,
            eventType: created.eventType,
            internalOnly: created.internalOnly,
          },
          maskImages: false,
        },
        tx,
      );
      return created;
    });
  }

  async updateStaffFields(
    principal: Principal,
    access: Access,
    id: string,
    request: HotelEnquiryStaffUpdateRequest,
  ): Promise<HotelEnquiryStaffView> {
    const current = await this.requireInScope(id, principal, access);
    await this.assignment.assertAssignable(request.assignedUserId, current.assignedUserId);
    const actorId = staffId(principal);
    await this.prisma.$transaction(async (tx) => {
      await this.enquiries.updateStaffFields(id, buildStaffPatch(request), actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel_enquiry",
          entityId: id,
          before: { assignedUserId: current.assignedUserId, notesInternal: current.notesInternal },
          after: {
            assignedUserId:
              request.assignedUserId !== undefined
                ? request.assignedUserId
                : current.assignedUserId,
            notesInternal:
              request.notesInternal !== undefined ? request.notesInternal : current.notesInternal,
          },
          maskImages: false,
        },
        tx,
      );
    });
    return this.staffView(await this.requireInScope(id, principal, access), principal);
  }

  /** One row in the staff view, with its names and newest proposal looked up. */
  private async staffView(row: EnquiryRow, principal: Principal): Promise<HotelEnquiryStaffView> {
    const extras = await this.insights.extrasOf(row);
    return toEnquiryStaffView(row, this.canReadInternalNotes(principal), extras);
  }

  private canReadInternalNotes(principal: Principal): boolean {
    return can(toPolicyPrincipal(principal), INTERNAL_NOTES_KEY);
  }

  /** A staff read of one enquiry within the guard's scope (security.md: scope every query); 404 if out. */
  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<EnquiryRow> {
    const scope = recordScope(principal, access.scope);
    const row = await this.enquiries.findByIdInScope(id, scope.where);
    if (!row) throw errors.notFound();
    return row;
  }
}
