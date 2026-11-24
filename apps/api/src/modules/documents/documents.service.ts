import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  AppError,
  CONTENT_KINDS,
  DOCUMENT_TYPE_RULES,
  documentTypeKinds,
  errors,
  isAppError,
  type ContentKind,
  type DocumentLinkView,
  type DocumentType,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { loggableDetail, uploadRefusal } from "../../common/upload-refusal.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { AV_SCANNER, type AvScanner } from "../../storage/av-scanner.js";
import {
  IMAGE_PROCESSOR,
  type DocumentImageFormat,
  type ImageProcessor,
} from "../../storage/image.processor.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "../../storage/storage.types.js";
import { inspectContent } from "./content/inspect-content.js";
import { downloadFileName } from "./document-content.js";
import {
  DocumentsRepository,
  type DocumentOwner,
  type DocumentRow,
} from "./documents.repository.js";

/** A minted link's lifetime (security.md: 15 minutes). */
const LINK_TTL_MS = 15 * 60 * 1000;

/**
 * Downloads one link allows. Above 1 because a browser's built-in PDF viewer re-fetches the file for
 * its own download and print buttons; the 15-minute expiry still bounds the link.
 */
const LINK_MAX_DOWNLOADS = 5;

/** The image kinds a document keeps re-encoded, each in the format it came in (D-187 §3). */
const IMAGE_FORMATS: Readonly<Partial<Record<ContentKind, DocumentImageFormat>>> = {
  jpeg: "jpeg",
  png: "png",
};

export interface StoreDocumentInput {
  readonly owner: DocumentOwner;
  readonly accountId: string | null;
  readonly projectId: string | null;
  readonly documentType: DocumentType;
  readonly title: string;
  readonly bytes: Buffer;
  /** The document this one replaces on the same owner, if any; it gets the next version number. */
  readonly previousVersionId: string | null;
}

/** The bytes a link serves, with the content type and a PII-free file name for the download. */
export interface DocumentBlob {
  readonly bytes: Buffer;
  readonly mimeType: string;
  readonly fileName: string;
}

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

/**
 * Module N documents (data-model §16, D-132): store a file for an owning record and serve it only
 * through a minted, expiring access link. The caller (the owning module's service) has already checked
 * the principal may act on the owner; this service scopes every read by that owner, so a document is
 * reached only through its record (security.md). Storing validates fully before anything is kept, in
 * this order (D-187 §2 and §3): the content checks decide the file's kind, which the document type must
 * take; the kind's cap for the type; an antivirus scan. A file that fails is refused outright, since a
 * document has no quarantine state. An image is then re-encoded without its metadata through the shared
 * image queue, and those are the bytes kept, sized and checksummed, under the detected kind's type. The
 * bytes are written first, then the row, its audit and the caller's attach step commit in one
 * transaction; if that fails the bytes are removed again.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentsRepository,
    private readonly audit: AuditService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(AV_SCANNER) private readonly scanner: AvScanner,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessor,
    private readonly logger: AppLogger,
  ) {}

  async store(
    input: StoreDocumentInput,
    actorId: string,
    attach: (document: DocumentRow, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<DocumentRow> {
    const kind = await this.validate(input);
    const bytes = await this.keptBytes(input.bytes, kind);
    const previous = await this.previousVersion(input);
    const mimeType = CONTENT_KINDS[kind].mimeType;
    const storageKey = `documents/${input.owner.ownerType}/${input.owner.ownerId}/${randomUUID()}`;
    await this.storage.putObject(storageKey, bytes, mimeType);
    try {
      return await this.repo.transaction(async (tx) => {
        const row = await this.repo.create(
          {
            owner: input.owner,
            accountId: input.accountId,
            projectId: input.projectId,
            title: input.title,
            documentType: input.documentType,
            storageKey,
            mimeType,
            sizeBytes: bytes.length,
            checksum: sha256(bytes),
            versionNumber: previous ? previous.versionNumber + 1 : 1,
            previousVersionId: previous?.id ?? null,
          },
          actorId,
          tx,
        );
        await this.auditCreate(row, tx);
        await attach(row, tx);
        return row;
      });
    } catch (error) {
      // Nothing committed, so keep no bytes: an orphan object would outlive every record that names it.
      await this.storage.deleteObject(storageKey);
      throw error;
    }
  }

  /**
   * Mint a 15-minute link to a document of this owner: its `document_access_links` row and the audit of
   * who opened access to which document commit together (security.md: a minted access is recorded).
   */
  async mintLink(id: string, owner: DocumentOwner, actorId: string): Promise<DocumentLinkView> {
    const document = await this.repo.findOwned(id, owner);
    if (!document) throw errors.notFound();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    const link = await this.repo.transaction(async (tx) => {
      const row = await this.repo.createLink(
        {
          documentId: document.id,
          tokenHash: sha256(token),
          expiresAt,
          maxDownloads: LINK_MAX_DOWNLOADS,
        },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "create",
          entityType: "document_access_link",
          entityId: row.id,
          before: {},
          after: {
            documentId: document.id,
            expiresAt: expiresAt.toISOString(),
            maxDownloads: LINK_MAX_DOWNLOADS,
          },
          maskImages: false,
        },
        tx,
      );
      return row;
    });
    return { url: `/documents/links/${link.id}/${token}`, expiresAt: expiresAt.toISOString() };
  }

  /** The bytes behind a link, counting the download; any failed check is the same 404 as absence. */
  async open(linkId: string, token: string): Promise<DocumentBlob> {
    const link = await this.repo.findLink(linkId);
    if (!link || !sameHash(link.tokenHash, sha256(token))) throw errors.notFound();
    if (!(await this.repo.consumeLink(linkId, new Date()))) throw errors.notFound();
    const blob = await this.repo.blobOf(link.documentId);
    if (!blob) throw errors.notFound();
    return {
      bytes: await this.storage.getObject(blob.storageKey),
      mimeType: blob.mimeType,
      fileName: downloadFileName(blob.documentType, blob.versionNumber, blob.mimeType),
    };
  }

  /** The document a replacement follows, on the same owner; null for a first version. */
  private async previousVersion(input: StoreDocumentInput): Promise<DocumentRow | null> {
    if (!input.previousVersionId) return null;
    return this.repo.findOwned(input.previousVersionId, input.owner);
  }

  /**
   * The bytes a document keeps (D-187 §3): an image re-encoded through the shared image queue, upright,
   * stripped of its metadata and never downscaled; anything else as uploaded. A refusal of the image
   * itself (over the pixel limit) keeps its wording; bytes that will not decode are refused.
   */
  private async keptBytes(uploaded: Buffer, kind: ContentKind): Promise<Buffer> {
    const format = IMAGE_FORMATS[kind];
    if (!format) return uploaded;
    try {
      return await this.images.reencode(uploaded, format);
    } catch (error) {
      if (isAppError(error)) throw error;
      throw uploadRefusal("image_undecodable");
    }
  }

  /**
   * The checks, then the kind's cap, then the scan, all before any stored state changes; the kind the
   * file is kept as. Each refusal says why on the file field.
   */
  private async validate(input: StoreDocumentInput): Promise<ContentKind> {
    const kind = await this.kindOf(input);
    const cap = DOCUMENT_TYPE_RULES[input.documentType][kind];
    if (cap === undefined) throw uploadRefusal("type_not_accepted");
    if (input.bytes.length > cap) throw overCap(cap);
    if ((await this.scanner.scan(input.bytes)) !== "clean") {
      const message = "The file failed the antivirus scan and was not stored";
      throw errors.validation([{ path: "file", message }], message);
    }
    return kind;
  }

  /** The kind the content checks find, among those the document type takes; a refusal is logged. */
  private async kindOf(input: StoreDocumentInput): Promise<ContentKind> {
    const accepted = new Set(documentTypeKinds(input.documentType));
    const result = await inspectContent(input.bytes, accepted);
    if (result.ok) return result.kind;
    this.logger.info("upload.refused", {
      reason: result.reason,
      detail: loggableDetail(result.detail),
      documentType: input.documentType,
      ownerType: input.owner.ownerType,
      sizeBytes: input.bytes.length,
    });
    throw uploadRefusal(result.reason);
  }

  private async auditCreate(row: DocumentRow, tx: Prisma.TransactionClient): Promise<void> {
    await this.audit.record(
      {
        action: "create",
        entityType: "document",
        entityId: row.id,
        before: {},
        after: {
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          documentType: row.documentType,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          versionNumber: row.versionNumber,
          previousVersionId: row.previousVersionId,
          visibility: row.visibility,
        },
        maskImages: false,
      },
      tx,
    );
  }
}

/** A file over its kind's cap for the document type: 413, naming the cap (D-187 §3). */
function overCap(capBytes: number): AppError {
  const mebibytes = Math.floor(capBytes / (1024 * 1024));
  const message = `The file is larger than ${mebibytes} MB, the limit for this type of file.`;
  return new AppError("payload_too_large", message, [{ path: "file", message }]);
}

/** Constant-time comparison of two hex hashes (equal length by construction). */
function sameHash(stored: string, given: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
