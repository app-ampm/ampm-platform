import { Injectable } from "@nestjs/common";
import { errors, type DocumentLinkView, type ServiceAgreementStaffView } from "@ampm/core";

import type { Access } from "../../../common/request-context.js";
import { recordScope } from "../../../db/scoping.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import type { DocumentOwner } from "../../documents/documents.repository.js";
import { DocumentsService } from "../../documents/documents.service.js";
import { type AgreementRow, ServiceAgreementsRepository } from "./service-agreements.repository.js";
import { toAgreementStaffView } from "./service-agreements.view.js";

/** The owner an agreement's documents are filed under (polymorphic documents.owner_type/owner_id). */
const OWNER_TYPE = "service_agreement";

const ownerOf = (agreement: AgreementRow): DocumentOwner => ({
  ownerType: OWNER_TYPE,
  ownerId: agreement.id,
});

/**
 * An agreement the client signed outside the app (feature 10.2: "staff mark signed offline with an
 * evidence document"). The client normally accepts in the portal; when they sign on paper or by email
 * instead, staff attach the signed copy and that is what records the acceptance: the document row, the
 * agreement's `sent → accepted` move (accepted by no portal user), its `document_id` and both audit rows
 * commit together, so there is never an acceptance without its evidence. The file is stored and served by
 * Module N's DocumentsService (D-132); access follows the agreement, loaded in the caller's scope first.
 */
@Injectable()
export class AgreementSignedCopyService {
  constructor(
    private readonly agreements: ServiceAgreementsRepository,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  async markSignedOffline(
    principal: Principal,
    access: Access,
    id: string,
    bytes: Buffer,
  ): Promise<ServiceAgreementStaffView> {
    const current = await this.requireInScope(id, principal, access);
    if (current.status !== "sent") {
      throw errors.conflict(
        `A ${current.status} agreement cannot be marked signed; only one waiting on the client can`,
      );
    }
    const actorId = actorOf(principal);
    await this.documents.store(
      {
        owner: ownerOf(current),
        accountId: current.accountId,
        projectId: current.projectId,
        documentType: "contract",
        title: "Signed service agreement",
        bytes,
        previousVersionId: current.documentId,
      },
      actorId,
      (document, tx) => this.accept(current, document.id, actorId, tx),
    );
    return toAgreementStaffView(await this.requireInScope(id, principal, access));
  }

  /** Mint a 15-minute link to the agreement's signed copy (a `document_access_links` row). */
  async link(principal: Principal, access: Access, id: string): Promise<DocumentLinkView> {
    const current = await this.requireInScope(id, principal, access);
    if (!current.documentId) throw errors.notFound("No signed copy is attached to this agreement");
    return this.documents.mintLink(current.documentId, ownerOf(current), actorOf(principal));
  }

  /** Inside the document's transaction: the CAS `sent → accepted` onto the signed copy, and its audit. */
  private async accept(
    current: AgreementRow,
    documentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const patch = {
      status: "accepted" as const,
      acceptedAt: new Date(),
      acceptedByUserId: null,
      documentId,
    };
    if ((await this.agreements.updateStatus(current.id, "sent", patch, actorId, tx)) === 0) {
      throw errors.conflict(
        "The agreement changed while you were working on it; reload and try again",
      );
    }
    await this.audit.record(
      {
        action: "update",
        entityType: "service_agreement",
        entityId: current.id,
        before: { status: current.status, documentId: current.documentId },
        after: { status: "accepted", documentId, signedOffline: true },
        maskImages: false,
      },
      tx,
    );
  }

  private async requireInScope(
    id: string,
    principal: Principal,
    access: Access,
  ): Promise<AgreementRow> {
    const row = await this.agreements.findByIdInScope(
      id,
      recordScope(principal, access.scope).where,
    );
    if (!row) throw errors.notFound();
    return row;
  }
}

/** The staff member acting (the guard admits only staff to these routes). */
function actorOf(principal: Principal): string {
  if (principal.type !== "staff") throw errors.forbidden();
  return principal.userId;
}
