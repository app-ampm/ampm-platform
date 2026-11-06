import { Injectable } from "@nestjs/common";
import {
  errors,
  type HotelProposalCreateRequest,
  type HotelProposalDecision,
  type HotelProposalInternalPage,
  type HotelProposalInternalView,
  type HotelProposalListQuery,
  type HotelProposalStatus,
  type HotelProposalUpdateRequest,
} from "@ampm/core";
import { can } from "@ampm/policy";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { recordScope } from "../../db/scoping.js";
import { EventBus } from "../../jobs/event-bus.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import { staffId } from "./enquiries.helpers.js";
import { moneyToDecimalString } from "./proposals.money.js";
import {
  advanceEnquiryOnShare,
  assertProposalChanged,
  buildLineWrites,
  buildTermsPatch,
  copyLineWrites,
  emitProposalEvent,
  isProposalExpired,
  proposalScope,
  runVersioned,
} from "./proposals.helpers.js";
import { proposalAccepted, proposalDeclined, proposalShared } from "./proposals.events.js";
import {
  type ProposalLineWrite,
  type ProposalRow,
  type ProposalWriteData,
  ProposalsRepository,
} from "./proposals.repository.js";
import { toProposalInternalView } from "./proposals.view.js";
import { isProposalTransitionAllowed } from "./proposal-status.js";

const INTERNAL_AMOUNT_KEY = "consultancy.proposals.read_internal_amount";

/**
 * The Hotel-team proposal workspace (feature 10.4, AC-05.2/AC-09), keyed on `consultancy.proposals.*`.
 * Create and edit are draft-only (a shared version is immutable — a change is a revision that supersedes
 * it); sharing best-effort advances the enquiry to `client_decision` and emits `proposal.shared`. The
 * internal total + margin are serialised only for a reader holding `read_internal_amount`. The status
 * machine is hand-rolled; every move is a compare-and-swap and audits. `decide` is the shared primitive
 * the client decision (accept/decline/revision) reuses.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly enquiriesRepo: EnquiriesRepository,
    private readonly enquiries: EnquiriesService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: EventBus,
    private readonly logger: AppLogger,
  ) {}

  async list(
    principal: Principal,
    access: Access,
    query: HotelProposalListQuery,
  ): Promise<HotelProposalInternalPage> {
    const withInternal = this.canReadInternalAmount(principal);
    const { rows, nextCursor } = await this.proposals.listStaff(
      proposalScope(principal, access),
      query,
    );
    return { items: rows.map((row) => toProposalInternalView(row, withInternal)), nextCursor };
  }

  async get(principal: Principal, access: Access, id: string): Promise<HotelProposalInternalView> {
    const row = await this.requireInScope(id, principal, access);
    return toProposalInternalView(row, this.canReadInternalAmount(principal));
  }

  async create(
    principal: Principal,
    access: Access,
    request: HotelProposalCreateRequest,
  ): Promise<HotelProposalInternalView> {
    const enquiry = await this.requireEnquiryInScope(request.enquiryId, principal, access);
    // One live version per enquiry: a second offer is a revision of the first, not a new proposal.
    if (await this.proposals.liveProposalExists(enquiry.id)) {
      throw errors.conflict(
        "This enquiry already has an active proposal; revise it to change the offer",
      );
    }
    const row = await this.createVersion(
      {
        enquiryId: enquiry.id,
        hotelId: enquiry.hotelId, // the enquiry's hotel, never the request
        validUntil: request.validUntil ? new Date(request.validUntil) : null,
        clientTotalAmount: moneyToDecimalString(request.clientTotal),
        internalTotalAmount: moneyToDecimalString(request.internalTotal),
        currency: request.clientTotal.currency,
        supersedesProposalId: null,
      },
      buildLineWrites(request.lines),
      staffId(principal),
    );
    return toProposalInternalView(row, this.canReadInternalAmount(principal));
  }

  async update(
    principal: Principal,
    access: Access,
    id: string,
    request: HotelProposalUpdateRequest,
  ): Promise<HotelProposalInternalView> {
    const current = await this.requireInScope(id, principal, access);
    if (current.status !== "draft") {
      throw errors.conflict(
        "Only a draft proposal can be edited; share creates a new version to change it",
      );
    }
    const actorId = staffId(principal);
    await this.prisma.$transaction(async (tx) => {
      const lines = request.lines ? buildLineWrites(request.lines) : undefined;
      assertProposalChanged(
        await this.proposals.updateDraft(id, buildTermsPatch(request), lines, actorId, tx),
      );
      await this.auditProposal(
        tx,
        "update",
        id,
        { status: "draft" },
        { status: "draft", edited: true },
      );
    });
    return toProposalInternalView(
      await this.requireInScope(id, principal, access),
      this.canReadInternalAmount(principal),
    );
  }

  async share(
    principal: Principal,
    access: Access,
    id: string,
  ): Promise<HotelProposalInternalView> {
    const current = await this.requireInScope(id, principal, access);
    if (current.status !== "draft") {
      throw errors.conflict(`A ${current.status} proposal cannot be shared`);
    }
    const enquiry = await this.requireEnquiryInScope(current.enquiryId, principal, access);
    const actorId = staffId(principal);
    await this.prisma.$transaction(async (tx) => {
      assertProposalChanged(
        await this.proposals.updateStatus(
          id,
          "draft",
          { status: "shared", sharedAt: new Date() },
          actorId,
          tx,
        ),
      );
      await this.auditProposal(tx, "update", id, { status: "draft" }, { status: "shared" });
    });
    const row = await this.requireInScope(id, principal, access);
    await advanceEnquiryOnShare(this.enquiries, this.logger, principal, access, enquiry);
    await emitProposalEvent(this.bus, this.logger, proposalShared, row, enquiry.accountId);
    return toProposalInternalView(row, this.canReadInternalAmount(principal));
  }

  async revise(
    principal: Principal,
    access: Access,
    id: string,
  ): Promise<HotelProposalInternalView> {
    const current = await this.requireInScope(id, principal, access);
    if (current.status !== "shared" && current.status !== "revision_requested") {
      throw errors.conflict(`A ${current.status} proposal cannot be revised`);
    }
    const row = await this.createVersion(
      {
        enquiryId: current.enquiryId,
        hotelId: current.hotelId,
        validUntil: current.validUntil,
        clientTotalAmount: current.clientTotalAmount.toString(),
        internalTotalAmount: current.internalTotalAmount.toString(),
        currency: current.currency,
        supersedesProposalId: current.id,
      },
      copyLineWrites(current.lines),
      staffId(principal),
      { id: current.id, fromStatus: current.status },
    );
    return toProposalInternalView(row, this.canReadInternalAmount(principal));
  }

  /** The decision primitive the client service reuses (and a staff on-behalf path, if added). A decision
   *  moves a `shared` proposal; accept/decline are blocked once `valid_until` has passed (expiry guard). */
  async decide(
    current: ProposalRow,
    deciderUserId: string,
    accountId: string,
    decision: HotelProposalDecision,
  ): Promise<void> {
    if (current.status !== "shared") {
      throw errors.conflict(`A ${current.status} proposal cannot be decided`);
    }
    if (!isProposalTransitionAllowed(current.status, decision)) {
      throw errors.conflict(`A proposal cannot move from ${current.status} to ${decision}`);
    }
    if (decision !== "revision_requested" && isProposalExpired(current.validUntil, new Date())) {
      throw errors.conflict("This proposal has expired; ask AMPM for a revised version");
    }
    const patch =
      decision === "revision_requested"
        ? { status: decision }
        : { status: decision, decidedAt: new Date(), decidedByUserId: deciderUserId };
    await this.prisma.$transaction(async (tx) => {
      assertProposalChanged(
        await this.proposals.updateStatus(current.id, "shared", patch, deciderUserId, tx),
      );
      await this.auditProposal(
        tx,
        "update",
        current.id,
        { status: "shared" },
        { status: decision },
      );
    });
    if (decision === "accepted")
      await emitProposalEvent(this.bus, this.logger, proposalAccepted, current, accountId);
    if (decision === "declined")
      await emitProposalEvent(this.bus, this.logger, proposalDeclined, current, accountId);
  }

  /** The versioned create both create (new chain) and revise (supersedes a predecessor) go through: the
   *  version number + the create + the predecessor's CAS supersede + the audit, in one transaction, with
   *  the (enquiry_id, version_number) race mapped to a clean 409. */
  private async createVersion(
    base: Omit<ProposalWriteData, "versionNumber">,
    lines: readonly ProposalLineWrite[],
    actorId: string,
    supersede?: { id: string; fromStatus: HotelProposalStatus },
  ): Promise<ProposalRow> {
    return runVersioned(() =>
      this.prisma.$transaction(async (tx) => {
        const versionNumber = await this.proposals.nextVersion(base.enquiryId, tx);
        const created = await this.proposals.create({ ...base, versionNumber }, lines, actorId, tx);
        if (supersede) {
          assertProposalChanged(
            await this.proposals.updateStatus(
              supersede.id,
              supersede.fromStatus,
              { status: "superseded" },
              actorId,
              tx,
            ),
          );
        }
        await this.auditProposal(
          tx,
          "create",
          created.id,
          {},
          {
            status: "draft",
            versionNumber,
            ...(supersede ? { supersedes: supersede.id } : {}),
          },
        );
        return created;
      }),
    );
  }

  private canReadInternalAmount(principal: Principal): boolean {
    return can(toPolicyPrincipal(principal), INTERNAL_AMOUNT_KEY);
  }

  private async auditProposal(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    action: "create" | "update",
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record(
      { action, entityType: "hotel_proposal", entityId, before, after, maskImages: false },
      tx,
    );
  }

  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<ProposalRow> {
    const row = await this.proposals.findByIdInScope(id, proposalScope(principal, access));
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
