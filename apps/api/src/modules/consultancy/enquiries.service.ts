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
  type HotelEnquiryStatus,
  type HotelEnquiryStatusUpdateRequest,
} from "@ampm/core";
import { can, canTransition, type TransitionContext } from "@ampm/policy";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { recordScope } from "../../db/scoping.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { ServiceAgreementsService } from "../crm/service-agreements/service-agreements.service.js";
import {
  EnquiriesRepository,
  type EnquiryRow,
  type EnquiryStatusPatch,
} from "./enquiries.repository.js";
import { BookingMilestonesRepository } from "./booking-milestones.repository.js";
import { EnquiryEventsRepository, type EnquiryEventRow } from "./enquiry-events.repository.js";
import {
  buildStaffPatch,
  buildStatusPatch,
  guardChargeableStage,
  guardConfirmedReady,
  isInherentlyInternalEvent,
  staffId,
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
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly agreements: ServiceAgreementsService,
    private readonly milestones: BookingMilestonesRepository,
    private readonly logger: AppLogger,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: HotelEnquiryListQuery,
  ): Promise<HotelEnquiryStaffPage> {
    const scope = recordScope(principal, access.scope);
    const withNotes = this.canReadInternalNotes(principal);
    const { rows, nextCursor } = await this.enquiries.listStaff(scope.where, query);
    return { items: rows.map((row) => toEnquiryStaffView(row, withNotes)), nextCursor };
  }

  async get(
    principal: Principal,
    access: Access,
    id: string,
  ): Promise<HotelEnquiryStaffDetailView> {
    const scope = recordScope(principal, access.scope);
    const row = await this.enquiries.findByIdInScope(id, scope.where);
    if (!row) throw errors.notFound();
    const events = await this.events.listByEnquiry(row.id);
    return toEnquiryStaffDetailView(row, events, this.canReadInternalNotes(principal));
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
    await this.persistTransition(current, patch, to, request.summary, staffId(principal));
    if (isClientVisibleStatus(to)) {
      await this.notifyClient(current.accountId, current.id).catch(() =>
        this.logger.warn("consultancy.enquiry.notify_failed", { enquiryId: current.id }),
      );
    }
    return toEnquiryStaffView(
      await this.requireInScope(id, principal, access),
      this.canReadInternalNotes(principal),
    );
  }

  private transitionContext(current: EnquiryRow): TransitionContext {
    return {
      projectId: current.projectId ?? undefined,
      accountId: current.accountId,
      assigneeId: current.assignedUserId ?? undefined,
      requesterId: current.requestedByUserId,
    };
  }

  private async persistTransition(
    current: EnquiryRow,
    patch: EnquiryStatusPatch,
    to: HotelEnquiryStatus,
    summary: string | null,
    actorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.enquiries.updateStatus(current.id, patch, actorId, tx);
      await this.events.create(
        {
          enquiryId: current.id,
          eventType: "status_change",
          occurredAt: new Date(),
          userId: actorId,
          summary,
          internalOnly: !isClientVisibleStatus(to),
          documentId: null,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel_enquiry",
          entityId: current.id,
          before: { status: current.status, outcome: current.outcome },
          after: { status: to, outcome: patch.outcome ?? current.outcome },
          maskImages: false,
        },
        tx,
      );
    });
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
    return toEnquiryStaffView(
      await this.requireInScope(id, principal, access),
      this.canReadInternalNotes(principal),
    );
  }

  private canReadInternalNotes(principal: Principal): boolean {
    return can(toPolicyPrincipal(principal), INTERNAL_NOTES_KEY);
  }

  private async notifyClient(accountId: string, enquiryId: string): Promise<void> {
    const userIds = await this.enquiries.accountClientUserIds(accountId);
    await Promise.all(
      userIds.map((recipientId) =>
        this.notifications.queue({
          recipientType: "user",
          recipientId,
          channel: "in_app",
          eventType: "enquiry.status_changed",
          templateKey: "enquiry.status_changed",
          entityType: "hotel_enquiry",
          entityId: enquiryId,
        }),
      ),
    );
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
