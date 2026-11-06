import { Injectable } from "@nestjs/common";
import {
  errors,
  type ServiceAgreementCreateRequest,
  type ServiceAgreementListQuery,
  type ServiceAgreementStaffPage,
  type ServiceAgreementStaffView,
  type ServiceAgreementStatus,
  type ServiceAgreementTransitionRequest,
  type ServiceAgreementUpdateRequest,
} from "@ampm/core";

import type { Access } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { recordScope } from "../../../db/scoping.js";
import { AuditService } from "../../../policy/audit.service.js";
import { type Principal } from "../../../policy/principal.types.js";
import { PrincipalService } from "../../../policy/principal.service.js";
import { moneyToDecimal } from "./service-agreements.money.js";
import {
  type AgreementRow,
  type AgreementStatusPatch,
  type AgreementTermsPatch,
  ServiceAgreementsRepository,
} from "./service-agreements.repository.js";
import { toAgreementStaffView } from "./service-agreements.view.js";
import {
  agreementAffectsEntitlement,
  isAgreementTransitionAllowed,
  isTerminalAgreement,
} from "./service-agreement-status.js";

/**
 * The commercial workspace for paid-service agreements (feature 10.2, GP-5). Reads/writes are keyed on
 * `crm.service_agreements.*` and scoped through `@CurrentAccess`. The status machine is hand-rolled
 * (service-agreement-status.ts) since §7 has no agreement rows; every move audits in its transaction,
 * and a move into or out of `active` busts the account's entitlement cache so the next request
 * recomputes `hotel_assistance`. `applyTransition` / `accept` are the shared engine the client accept
 * (sent → accepted) reuses; `hasActiveForEnquiry` answers the consultancy AC-05.7 gate.
 */
@Injectable()
export class ServiceAgreementsService {
  constructor(
    private readonly agreements: ServiceAgreementsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly principals: PrincipalService,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: ServiceAgreementListQuery,
  ): Promise<ServiceAgreementStaffPage> {
    const scope = recordScope(principal, access.scope);
    const { rows, nextCursor } = await this.agreements.listStaff(scope.where, query);
    return { items: rows.map(toAgreementStaffView), nextCursor };
  }

  async get(principal: Principal, access: Access, id: string): Promise<ServiceAgreementStaffView> {
    return toAgreementStaffView(await this.requireInScope(id, principal, access));
  }

  async create(
    principal: Principal,
    request: ServiceAgreementCreateRequest,
  ): Promise<ServiceAgreementStaffView> {
    const actorId = staffId(principal);
    // The service_type must exist and be active; a bad id is a validation error, not a dangling FK.
    const category = await this.agreements.serviceTypeCategory(request.serviceTypeId);
    if (!category) {
      throw errors.validation([
        { path: "serviceTypeId", message: "Unknown or inactive service type" },
      ]);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await this.agreements.create(
        {
          accountId: request.accountId,
          serviceTypeId: request.serviceTypeId,
          hotelEnquiryId: request.hotelEnquiryId,
          scopeText: request.scopeText,
          feeAmount: moneyToDecimal(request.fee),
          feeStructure: request.feeStructure,
          currency: request.fee.currency,
          termsVersion: request.termsVersion,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "create",
          entityType: "service_agreement",
          entityId: created.id,
          after: {
            accountId: created.accountId,
            status: created.status,
            serviceTypeId: created.serviceTypeId,
          },
          maskImages: false,
        },
        tx,
      );
      return created;
    });
    return toAgreementStaffView(row);
  }

  async updateTerms(
    principal: Principal,
    access: Access,
    id: string,
    request: ServiceAgreementUpdateRequest,
  ): Promise<ServiceAgreementStaffView> {
    const current = await this.requireInScope(id, principal, access);
    // Immutable once shared (data.md): terms may be edited only while the agreement is still a draft.
    if (current.status !== "draft") {
      throw errors.conflict("Only a draft agreement's terms can be edited");
    }
    const patch = buildTermsPatch(request);
    const actorId = staffId(principal);
    await this.prisma.$transaction(async (tx) => {
      await this.agreements.updateTerms(id, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "service_agreement",
          entityId: id,
          before: { scopeText: current.scopeText, feeStructure: current.feeStructure },
          after: {
            scopeText: patch.scopeText ?? current.scopeText,
            feeStructure: patch.feeStructure ?? current.feeStructure,
          },
          maskImages: false,
        },
        tx,
      );
    });
    return toAgreementStaffView(await this.requireInScope(id, principal, access));
  }

  async transition(
    principal: Principal,
    access: Access,
    id: string,
    request: ServiceAgreementTransitionRequest,
  ): Promise<ServiceAgreementStaffView> {
    const current = await this.requireInScope(id, principal, access);
    // A staff mark-accepted-offline records acceptance without a known accepting user (null).
    await this.applyTransition(current, request.status, staffId(principal), null);
    return toAgreementStaffView(await this.requireInScope(id, principal, access));
  }

  /** The AC-05.7 gate (read by the consultancy module through this service, not its tables). */
  async hasActiveForEnquiry(enquiryId: string): Promise<boolean> {
    return this.agreements.hasActiveForEnquiry(enquiryId);
  }

  /** The client accept (sent → accepted): the client service scopes to the account, then calls this. */
  async accept(current: AgreementRow, clientUserId: string): Promise<void> {
    if (current.status !== "sent") {
      throw errors.conflict(`A ${current.status} agreement cannot be accepted`);
    }
    await this.applyTransition(current, "accepted", clientUserId, clientUserId);
  }

  private async applyTransition(
    current: AgreementRow,
    to: ServiceAgreementStatus,
    actorId: string,
    acceptedByUserId: string | null,
  ): Promise<void> {
    if (isTerminalAgreement(current.status)) {
      throw errors.conflict(`A ${current.status} agreement is read-only`);
    }
    if (!isAgreementTransitionAllowed(current.status, to)) {
      throw errors.conflict(`An agreement cannot move from ${current.status} to ${to}`);
    }
    const patch: AgreementStatusPatch =
      to === "accepted" ? { status: to, acceptedAt: new Date(), acceptedByUserId } : { status: to };
    await this.prisma.$transaction(async (tx) => {
      const changed = await this.agreements.updateStatus(
        current.id,
        current.status,
        patch,
        actorId,
        tx,
      );
      if (changed === 0) {
        // The row moved under us (a concurrent transition); fail cleanly rather than overwrite.
        throw errors.conflict(
          "The agreement changed while you were working on it; reload and try again",
        );
      }
      await this.audit.record(
        {
          action: "update",
          entityType: "service_agreement",
          entityId: current.id,
          before: { status: current.status },
          after: { status: to },
          maskImages: false,
        },
        tx,
      );
    });
    if (agreementAffectsEntitlement(current.status, to)) {
      await this.refreshEntitlements(current.accountId);
    }
  }

  /** After a move into/out of `active`: recompute each account client user's entitlements (bust cache). */
  private async refreshEntitlements(accountId: string): Promise<void> {
    const userIds = await this.agreements.accountClientUserIds(accountId);
    for (const userId of userIds) this.principals.invalidateEntitlements(userId);
  }

  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<AgreementRow> {
    const scope = recordScope(principal, access.scope);
    const row = await this.agreements.findByIdInScope(id, scope.where);
    if (!row) throw errors.notFound();
    return row;
  }
}

/** The defined fields of a terms update, so an omitted field is left untouched. */
function buildTermsPatch(request: ServiceAgreementUpdateRequest): AgreementTermsPatch {
  const patch: {
    scopeText?: AgreementTermsPatch["scopeText"];
    feeAmount?: AgreementTermsPatch["feeAmount"];
    feeStructure?: AgreementTermsPatch["feeStructure"];
    termsVersion?: AgreementTermsPatch["termsVersion"];
  } = {};
  if (request.scopeText !== undefined) patch.scopeText = request.scopeText;
  if (request.fee !== undefined) patch.feeAmount = moneyToDecimal(request.fee);
  if (request.feeStructure !== undefined) patch.feeStructure = request.feeStructure;
  if (request.termsVersion !== undefined) patch.termsVersion = request.termsVersion;
  return patch;
}

/** The acting staff user's id; a non-staff principal never reaches these guarded routes. */
function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}
