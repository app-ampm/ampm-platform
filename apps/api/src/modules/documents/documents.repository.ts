import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma, type DocumentType } from "../../generated/prisma/client.js";

/*
 * Prisma access for Module N documents (D-132): queries and scoping, no business rules. The SECRET
 * columns — `storage_key` and the link's `token_hash` — are selected only by the two narrow projections
 * the service needs to serve bytes or check a token, never by DOCUMENT_SELECT, so they cannot reach a
 * response. Documents are polymorphic (owner_type + owner_id, no FK): reads are scoped by the owner the
 * caller already authorised, and by the types it keeps when it names them, so a document is never
 * reached by its id alone (access follows the record).
 */
const DOCUMENT_SELECT = {
  id: true,
  ownerType: true,
  ownerId: true,
  title: true,
  documentType: true,
  mimeType: true,
  sizeBytes: true,
  versionNumber: true,
  previousVersionId: true,
  visibility: true,
  uploadedBy: true,
  createdAt: true,
} as const satisfies Prisma.DocumentSelect;

export type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>;

/** The owning record a document belongs to; the caller has already checked access to it. */
export interface DocumentOwner {
  readonly ownerType: string;
  readonly ownerId: string;
  /**
   * The types of document the owner keeps, when it keeps only some (a hotel's library, D-187 §6):
   * every read, lock and count scoped by this owner leaves out its rows of any other type, which are
   * then absent to the caller, a 404.
   */
  readonly documentTypes?: readonly DocumentType[] | undefined;
}

/** The live rows of an owner, of the types it keeps. */
function ownedBy(owner: DocumentOwner): Prisma.DocumentWhereInput {
  return {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    deletedAt: null,
    ...(owner.documentTypes ? { documentType: { in: [...owner.documentTypes] } } : {}),
  };
}

/** The owner's type scope in raw SQL, on the `documents` row the query names `document_type` of. */
function typeScope(owner: DocumentOwner): Prisma.Sql {
  if (!owner.documentTypes) return Prisma.empty;
  return Prisma.sql`AND document_type::text = ANY(${[...owner.documentTypes]})`;
}

export interface DocumentWriteData {
  readonly owner: DocumentOwner;
  readonly accountId: string | null;
  readonly projectId: string | null;
  readonly title: string;
  readonly documentType: DocumentType;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly versionNumber: number;
  readonly previousVersionId: string | null;
}

export interface LinkWriteData {
  readonly documentId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly maxDownloads: number;
}

/** What serving a link needs: the stored object and how to name it. Never leaves the service. */
export interface DocumentBlobRow {
  readonly storageKey: string;
  readonly mimeType: string;
  readonly documentType: DocumentType;
  readonly versionNumber: number;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: DocumentWriteData,
    uploadedBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<DocumentRow> {
    const { owner, ...fields } = data;
    return client.document.create({
      data: {
        ...fields,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        visibility: "internal",
        uploadedBy,
        createdBy: uploadedBy,
      },
      select: DOCUMENT_SELECT,
    });
  }

  /** A live document of this owner, or null — the owner check that makes access follow the record. */
  async findOwned(id: string, owner: DocumentOwner): Promise<DocumentRow | null> {
    return this.prisma.document.findFirst({
      where: { id, ...ownedBy(owner) },
      select: DOCUMENT_SELECT,
    });
  }

  /** Every live row of this owner, every version included, newest first (D-187 §6). */
  listByOwner(owner: DocumentOwner): Promise<DocumentRow[]> {
    return this.prisma.document.findMany({
      where: ownedBy(owner),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: DOCUMENT_SELECT,
    });
  }

  /**
   * Locks a live document of this owner until the transaction ends, so a replacement and a removal of
   * the same document run one after the other. False when there is no such document.
   */
  async lockOwned(
    id: string,
    owner: DocumentOwner,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM documents
      WHERE id = ${id}::uuid AND owner_type = ${owner.ownerType} AND owner_id = ${owner.ownerId}::uuid
        AND deleted_at IS NULL ${typeScope(owner)}
      FOR UPDATE`;
    return rows.length > 0;
  }

  /** Whether a live row other than `except` follows this document: then it is no longer the latest. */
  async hasSuccessor(
    id: string,
    except: string | null,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<boolean> {
    const row = await client.document.findFirst({
      where: { previousVersionId: id, deletedAt: null, ...(except ? { id: { not: except } } : {}) },
      select: { id: true },
    });
    return row !== null;
  }

  /** How many live documents this owner holds: live rows, of its types, that no live row follows. */
  async countLive(
    owner: DocumentOwner,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const rows = await client.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM documents d
      WHERE d.owner_type = ${owner.ownerType} AND d.owner_id = ${owner.ownerId}::uuid
        AND d.deleted_at IS NULL ${typeScope(owner)}
        AND NOT EXISTS (
          SELECT 1 FROM documents s WHERE s.previous_version_id = d.id AND s.deleted_at IS NULL
        )`;
    return Number(rows[0]?.count ?? 0);
  }

  /** Soft-deletes these live rows; the number it removed. */
  async softDelete(
    ids: readonly string[],
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await tx.document.updateMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return result.count;
  }

  async createLink(
    data: LinkWriteData,
    createdBy: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ id: string }> {
    return client.documentAccessLink.create({
      data: { ...data, createdBy },
      select: { id: true },
    });
  }

  /** A live link's document and token hash (SECRET — compared in the service, never returned). */
  async findLink(id: string): Promise<{ documentId: string; tokenHash: string } | null> {
    return this.prisma.documentAccessLink.findFirst({
      where: { id, deletedAt: null, revokedAt: null },
      select: { documentId: true, tokenHash: true },
    });
  }

  /**
   * Count one download against the link — a compare-and-swap that succeeds only while the link is
   * unexpired, unrevoked and under its download cap, so concurrent fetches can never exceed the cap.
   */
  async consumeLink(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.documentAccessLink.updateMany({
      where: {
        id,
        deletedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        downloadCount: { lt: this.prisma.documentAccessLink.fields.maxDownloads },
      },
      data: { downloadCount: { increment: 1 } },
    });
    return result.count === 1;
  }

  async blobOf(id: string): Promise<DocumentBlobRow | null> {
    return this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      select: { storageKey: true, mimeType: true, documentType: true, versionNumber: true },
    });
  }

  /** Runs `work` in one transaction so a document, the record it attaches to and their audits commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
