import { Injectable } from "@nestjs/common";
import {
  errors,
  type LeadActivityCreateRequest,
  type LeadActivityList,
  type LeadActivityView,
  type LeadCreateRequest,
  type LeadFunnelQuery,
  type LeadFunnelView,
  type LeadListQuery,
  type LeadPage,
  type LeadStatus,
  type LeadUpdateRequest,
  type LeadView,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import { LeadActivitiesRepository } from "./lead-activities.repository.js";
import { LeadsRepository, type LeadRow, type LeadUpdatePatch } from "./leads.repository.js";
import { toActivityView, toLeadView } from "./leads.view.js";

const PRIVACY_NOTICE_VERSION = "2026-10";
/** Past `new`, a lead must have an owner to receive follow-up reminders (field-matrix leads.owner_user_id). */
const OWNED_STATUSES: readonly LeadStatus[] = [
  "contacted",
  "introduction_shared",
  "demo_offered",
  "demo_accessed",
  "follow_up",
];

/**
 * The Sales lead workspace (TW-10/TW-11). Reads are gated by `crm.leads.read`, writes by
 * `crm.leads.update`/`create`; the controller audits create/update/assign/activity through the
 * interceptor, while a merge writes its own precise audit here (AC-01.6). A converted lead is
 * read-only (AC-01.8). Conversion to a client account is feature 8.2.
 */
@Injectable()
export class LeadsService {
  constructor(
    private readonly leads: LeadsRepository,
    private readonly activities: LeadActivitiesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: LeadListQuery): Promise<LeadPage> {
    const { rows, nextCursor } = await this.leads.list(
      { status: query.status, ownerUserId: query.ownerUserId, source: query.source, q: query.q },
      query.limit,
      query.cursor,
    );
    return { items: await this.decorate(rows), nextCursor };
  }

  async get(leadId: string): Promise<LeadView> {
    const [view] = await this.decorate([await this.require(leadId)]);
    if (!view) throw errors.notFound("No such lead");
    return view;
  }

  async getActivities(leadId: string): Promise<LeadActivityList> {
    await this.require(leadId);
    const rows = await this.activities.listByLead(leadId);
    return { items: rows.map(toActivityView) };
  }

  async create(request: LeadCreateRequest, actorId: string): Promise<LeadView> {
    const source = await this.leads.findActiveSourceByKey(request.source);
    if (!source) throw errors.validation([{ path: "source", message: "Unknown lead source" }]);
    const leadId = await this.leads.create({
      sourceId: source.id,
      status: "new",
      name: request.name,
      email: request.email ?? null,
      phone: request.phone ?? null,
      contactPreference: request.contactPreference ?? null,
      tentativeDateFrom: toDate(request.tentativeDateFrom),
      tentativeDateTo: toDate(request.tentativeDateTo),
      destinationId: request.destinationId ?? null,
      destinationText: request.destinationText ?? null,
      guestEstimate: request.guestEstimate ?? null,
      requirements: request.requirements ?? null,
      consentMarketing: request.consentMarketing,
      consentAt: new Date(),
      consentNoticeVersion: PRIVACY_NOTICE_VERSION,
      requestedDemo: request.requestedDemo ?? false,
      ownerUserId: request.ownerUserId ?? null,
      duplicateOfLeadId: null,
      createdBy: actorId,
    });
    return this.get(leadId);
  }

  async update(leadId: string, request: LeadUpdateRequest, actorId: string): Promise<LeadView> {
    const current = await this.require(leadId);
    if (current.status === "converted") throw errors.conflict("A converted lead is read-only");
    if (request.status === "converted") {
      throw errors.validation([
        { path: "status", message: "Convert a lead through the convert action" },
      ]);
    }
    this.guardTransition(current, request);
    await this.leads.update(leadId, buildPatch(request), actorId);
    return this.get(leadId);
  }

  async assign(leadId: string, ownerUserId: string | null, actorId: string): Promise<LeadView> {
    const current = await this.require(leadId);
    if (current.status === "converted") throw errors.conflict("A converted lead is read-only");
    await this.leads.update(leadId, { ownerUserId }, actorId);
    return this.get(leadId);
  }

  async addActivity(
    leadId: string,
    request: LeadActivityCreateRequest,
    userId: string,
  ): Promise<LeadActivityView> {
    const current = await this.require(leadId);
    if (current.status === "converted") throw errors.conflict("A converted lead is read-only");
    const row = await this.activities.create(
      {
        leadId,
        activityType: request.activityType,
        occurredAt: request.occurredAt ? new Date(request.occurredAt) : new Date(),
        userId,
        summary: request.summary ?? null,
        questionnaireJson: request.questionnaireJson,
        nextFollowUpAt: request.nextFollowUpAt ? new Date(request.nextFollowUpAt) : null,
      },
      userId,
    );
    return toActivityView(row);
  }

  /** Merge a duplicate into the survivor the Sales user picked: move activities, close the duplicate
   *  as `merged`, audit it. Never automatic — this is always a staff decision (AC-01.6). */
  async merge(duplicateId: string, survivorLeadId: string, actorId: string): Promise<LeadView> {
    if (duplicateId === survivorLeadId) {
      throw errors.validation([{ path: "survivorLeadId", message: "Pick a different survivor" }]);
    }
    const duplicate = await this.require(duplicateId);
    await this.require(survivorLeadId);
    if (duplicate.status === "converted")
      throw errors.conflict("A converted lead cannot be merged");
    await this.prisma.$transaction(async (tx) => {
      await this.activities.reassignLead(duplicateId, survivorLeadId, actorId, tx);
      await this.leads.closeAsDuplicate(duplicateId, survivorLeadId, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "lead",
          entityId: duplicateId,
          before: { status: duplicate.status },
          after: { status: "closed", closedReason: "merged", mergedInto: survivorLeadId },
          maskImages: false,
        },
        tx,
      );
    });
    return this.get(survivorLeadId);
  }

  async funnel(query: LeadFunnelQuery): Promise<LeadFunnelView> {
    return this.leads.funnel(toDate(query.from), toDate(query.to));
  }

  private guardTransition(current: LeadRow, request: LeadUpdateRequest): void {
    const nextStatus = request.status ?? current.status;
    const owner = request.ownerUserId !== undefined ? request.ownerUserId : current.ownerUserId;
    const closedReason = request.closedReason ?? current.closedReason;
    if (OWNED_STATUSES.includes(nextStatus) && !owner) {
      throw errors.validation([
        { path: "ownerUserId", message: "Assign an owner before moving the lead past new" },
      ]);
    }
    if (nextStatus === "closed" && !closedReason) {
      throw errors.validation([
        { path: "closedReason", message: "Give a reason before closing the lead" },
      ]);
    }
  }

  private async decorate(rows: LeadRow[]): Promise<LeadView[]> {
    const followUps = await this.activities.nextFollowUpByLead(rows.map((row) => row.id));
    return rows.map((row) => toLeadView(row, followUps.get(row.id) ?? null));
  }

  private async require(leadId: string): Promise<LeadRow> {
    const row = await this.leads.findById(leadId);
    if (!row) throw errors.notFound("No such lead");
    return row;
  }
}

function buildPatch(request: LeadUpdateRequest): LeadUpdatePatch {
  const patch: LeadUpdatePatch = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.email !== undefined) patch.email = request.email;
  if (request.phone !== undefined) patch.phone = request.phone;
  if (request.contactPreference !== undefined) patch.contactPreference = request.contactPreference;
  if (request.tentativeDateFrom !== undefined)
    patch.tentativeDateFrom = toDate(request.tentativeDateFrom);
  if (request.tentativeDateTo !== undefined)
    patch.tentativeDateTo = toDate(request.tentativeDateTo);
  if (request.destinationId !== undefined) patch.destinationId = request.destinationId;
  if (request.destinationText !== undefined) patch.destinationText = request.destinationText;
  if (request.guestEstimate !== undefined) patch.guestEstimate = request.guestEstimate;
  if (request.requirements !== undefined) patch.requirements = request.requirements;
  if (request.status !== undefined) patch.status = request.status;
  if (request.ownerUserId !== undefined) patch.ownerUserId = request.ownerUserId;
  if (request.closedReason !== undefined) patch.closedReason = request.closedReason;
  return patch;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
