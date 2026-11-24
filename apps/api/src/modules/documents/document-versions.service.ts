import { Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { versionChains, type VersionedDocument } from "./document-versions.js";
import {
  DocumentsRepository,
  type DocumentOwner,
  type DocumentRow,
} from "./documents.repository.js";

/** A live document of an owner: its latest version and the versions it replaced, newest first. */
export type OwnedDocument = VersionedDocument<DocumentRow>;

/**
 * The versions of an owner's documents (data-model §16, D-187 §6), for an owner that keeps a library,
 * the hotel first: its live documents with their earlier versions, the checks that a replacement or a
 * removal names the latest version, and the removal of a document with every version. Storing a file
 * and minting a link stay with DocumentsService. As there, the caller has already checked the
 * principal may act on the owner, and every read is scoped by that owner.
 */
@Injectable()
export class DocumentVersionsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly audit: AuditService,
  ) {}

  /** The owner's live documents, newest first, each with its earlier versions. */
  async listByOwner(owner: DocumentOwner): Promise<OwnedDocument[]> {
    return versionChains(await this.repo.listByOwner(owner));
  }

  /**
   * The live document whose latest version is `id`: 404 when the owner has no such live document, 409
   * when `id` is an earlier version (a newer one was filed since the caller last looked).
   */
  async requireLatest(id: string, owner: DocumentOwner): Promise<OwnedDocument> {
    const documents = await this.listByOwner(owner);
    const found = documents.find((document) => document.latest.id === id);
    if (found) return found;
    if (documents.some((document) => document.earlier.some((version) => version.id === id))) {
      throw replacedSince();
    }
    throw errors.notFound("No such document");
  }

  /**
   * Inside a transaction: locks the document a new version follows, and refuses when it is gone (404)
   * or another version has followed it meanwhile (409), so two replacements never both follow it.
   */
  async lockLatest(
    id: string,
    owner: DocumentOwner,
    newVersionId: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!(await this.repo.lockOwned(id, owner, tx))) throw errors.notFound("No such document");
    if (await this.repo.hasSuccessor(id, newVersionId, tx)) throw replacedSince();
  }

  /** How many live documents the owner holds, in a transaction when one is given. */
  countLive(owner: DocumentOwner, tx?: Prisma.TransactionClient): Promise<number> {
    return this.repo.countLive(owner, tx);
  }

  /**
   * Soft-deletes a live document named by its latest version, with every earlier version, and audits
   * each row, in one transaction.
   */
  async removeWithVersions(id: string, owner: DocumentOwner, actorId: string): Promise<void> {
    const document = await this.requireLatest(id, owner);
    const rows = [document.latest, ...document.earlier];
    await this.repo.transaction(async (tx) => {
      await this.lockLatest(id, owner, null, tx);
      await this.repo.softDelete(
        rows.map((row) => row.id),
        actorId,
        tx,
      );
      for (const row of rows) {
        await this.audit.record(
          {
            action: "delete",
            entityType: "document",
            entityId: row.id,
            before: {
              ownerType: row.ownerType,
              ownerId: row.ownerId,
              documentType: row.documentType,
              versionNumber: row.versionNumber,
              previousVersionId: row.previousVersionId,
            },
            after: { deleted: true },
            maskImages: false,
          },
          tx,
        );
      }
    });
  }
}

function replacedSince(): Error {
  return errors.conflict("A newer version of this document was filed since; reload and try again");
}
