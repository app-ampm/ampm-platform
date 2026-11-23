import { Injectable } from "@nestjs/common";
import { errors, type BookingMilestoneStaffView, type DocumentLinkView } from "@ampm/core";

import type { Access } from "../../common/request-context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import type { DocumentOwner } from "../documents/documents.repository.js";
import { DocumentsService } from "../documents/documents.service.js";
import { assertMilestoneChanged, milestoneScope } from "./booking-milestones.helpers.js";
import {
  BookingMilestonesRepository,
  type BookingMilestoneRow,
} from "./booking-milestones.repository.js";
import { toBookingMilestoneStaffView } from "./booking-milestones.view.js";
import { EnquiriesRepository } from "./enquiries.repository.js";

/** The owner a milestone's documents are filed under (polymorphic documents.owner_type/owner_id). */
const OWNER_TYPE = "booking_milestone";

const ownerOf = (milestone: BookingMilestoneRow): DocumentOwner => ({
  ownerType: OWNER_TYPE,
  ownerId: milestone.id,
});

/**
 * The signed contract on a `contract_signed` booking milestone (AC-05.6, D-132) — the interim contract
 * signal the enquiry's confirmed-guard reads until Module G contracts land. Access follows the owning
 * record (security.md): both routes load the milestone in the caller's scope first (the guard already
 * checked `consultancy.booking_milestones.update` to attach, `.read` to view), and the file itself is
 * stored and served by Module N's DocumentsService. Attaching is open while the milestone is pending or
 * overdue; a replacement becomes the next version of the previous file. The document row, the milestone's
 * `document_id` and both audit rows commit together.
 */
@Injectable()
export class MilestoneContractService {
  constructor(
    private readonly milestones: BookingMilestonesRepository,
    private readonly enquiries: EnquiriesRepository,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  async attach(
    principal: Principal,
    access: Access,
    id: string,
    bytes: Buffer,
  ): Promise<BookingMilestoneStaffView> {
    const current = await this.requireContractMilestone(id, principal, access);
    if (current.status !== "pending" && current.status !== "overdue") {
      throw errors.conflict(`A ${current.status} milestone is read-only`);
    }
    const enquiry = await this.enquiries.findById(current.enquiryId);
    if (!enquiry) throw errors.notFound();
    const actorId = staffId(principal);
    await this.documents.store(
      {
        owner: ownerOf(current),
        accountId: enquiry.accountId,
        projectId: current.projectId,
        documentType: "contract",
        title: "Signed contract",
        bytes,
        previousVersionId: current.documentId,
      },
      actorId,
      (document, tx) => this.pointAt(current, document.id, actorId, tx),
    );
    return toBookingMilestoneStaffView(await this.requireContractMilestone(id, principal, access));
  }

  /** Mint a 15-minute link to the milestone's attached contract (a `document_access_links` row). */
  async link(principal: Principal, access: Access, id: string): Promise<DocumentLinkView> {
    const current = await this.requireContractMilestone(id, principal, access);
    if (!current.documentId) throw errors.notFound("No signed contract is attached yet");
    return this.documents.mintLink(current.documentId, ownerOf(current), staffId(principal));
  }

  /** Inside the document's transaction: the milestone's CAS onto the new file, and its audit. */
  private async pointAt(
    current: BookingMilestoneRow,
    documentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    assertMilestoneChanged(
      await this.milestones.attachDocument(current.id, current, documentId, actorId, tx),
    );
    await this.audit.record(
      {
        action: "update",
        entityType: "booking_milestone",
        entityId: current.id,
        before: { documentId: current.documentId },
        after: { documentId },
        maskImages: false,
      },
      tx,
    );
  }

  private async requireContractMilestone(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<BookingMilestoneRow> {
    const row = await this.milestones.findByIdInScope(id, milestoneScope(principal, access));
    if (!row) throw errors.notFound();
    if (row.milestoneType !== "contract_signed") {
      throw errors.conflict("Only a contract signed milestone carries the signed contract");
    }
    return row;
  }
}
