import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type MediaAssetCreateRequest,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaDownloadUrl,
  type MediaListQuery,
  type MediaRemovedResponse,
  type MediaRightsStatus,
  type MediaVisibility,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "../../storage/storage.types.js";
import { AV_SCANNER, type AvScanner } from "./av-scanner.js";
import { detectMedia, MAX_UPLOAD_BYTES } from "./media-content.js";
import { MediaRepository, type MediaAssetRow } from "./media.repository.js";
import { toMediaAssetView } from "./media.view.js";

/** The lifetime of a signed media download link (security.md: 15 minutes). */
const DOWNLOAD_TTL_SECONDS = 900;

/** Rights statuses that may back client/demo/public visibility (GP-20). */
const PUBLISHABLE_RIGHTS: ReadonlySet<MediaRightsStatus> = new Set([
  "owned",
  "licensed",
  "consent_obtained",
]);

/** The rights-and-visibility image audited on a media change — the fields GP-20 compliance turns on. */
function rightsImage(row: MediaAssetRow): Record<string, unknown> {
  return {
    visibility: row.visibility,
    rightsStatus: row.rightsStatus,
    consentSourceProjectId: row.consentSourceProjectId,
    consentDocumentId: row.consentDocumentId,
  };
}

/**
 * Gallery media management (HT/SA; Module N, feature 9.3). The GP-20 rule — client, demo or public
 * visibility requires `rights_status` owned, licensed or consent_obtained — is enforced here on every
 * create and update (AC-24.3 → 409). The row is registered with a server-generated object key and starts
 * `pending`; the bytes, scan and derivatives arrive through the upload path (slice 3b). Create is audited
 * by the interceptor (@Audited); update and delete self-audit.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly audit: AuditService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(AV_SCANNER) private readonly scanner: AvScanner,
  ) {}

  async create(request: MediaAssetCreateRequest, actorId: string): Promise<MediaAssetView> {
    if (request.ownerType !== "hotel") {
      // media_assets is polymorphic, but only hotels are managed through this permission today; other
      // owner types gain their own authorization + membership scoping when their modules land (security.md).
      throw errors.validation([], "Only hotel media is supported in this release");
    }
    this.assertPublishable(request.visibility, request.rightsStatus);
    const storageKey = `${request.ownerType}/${request.ownerId}/${randomUUID()}`;
    return toMediaAssetView(await this.repo.create(request, storageKey, actorId));
  }

  async list(query: MediaListQuery): Promise<MediaAssetPage> {
    const { rows, nextCursor } = await this.repo.listByOwner(query.ownerType, query.ownerId, query);
    return { items: rows.map(toMediaAssetView), nextCursor };
  }

  async get(id: string): Promise<MediaAssetView> {
    return toMediaAssetView(await this.require(id));
  }

  async update(
    id: string,
    patch: MediaAssetUpdateRequest,
    actorId: string,
  ): Promise<MediaAssetView> {
    const current = await this.require(id);
    // Gate the RESULTING state, whatever the patch lands on (a visibility bump, a rights downgrade, both).
    this.assertPublishable(
      patch.visibility ?? current.visibility,
      patch.rightsStatus ?? current.rightsStatus,
    );
    // @SelfAudited: the mutation and its audit commit together, or neither does (there is no interceptor
    // backstop for a self-audited route).
    const row = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(id, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "media_asset",
          entityId: id,
          before: rightsImage(current),
          after: rightsImage(updated),
          maskImages: false,
        },
        tx,
      );
      return updated;
    });
    return toMediaAssetView(row);
  }

  async remove(id: string, actorId: string): Promise<MediaRemovedResponse> {
    const current = await this.require(id);
    await this.repo.transaction(async (tx) => {
      await this.repo.softDelete(id, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "media_asset",
          entityId: id,
          before: rightsImage(current), // what was removed, for a forensic trail (security.md)
          after: { deleted: true },
          maskImages: false,
        },
        tx,
      );
    });
    return { id };
  }

  /**
   * Store an uploaded object's bytes against the asset, by content (AC-20.2): the magic number decides the
   * type (a renamed executable is refused) and must match the declared kind; the size is bounded. The bytes
   * are scanned fail-closed (AC-20.3) and the row records the outcome — only a `clean` asset is downloadable.
   */
  async uploadBytes(id: string, bytes: Buffer, actorId: string): Promise<MediaAssetView> {
    const asset = await this.require(id);
    const detected = detectMedia(bytes);
    if (!detected) {
      throw errors.validation([], "Unsupported file type; allowed: JPEG, PNG, WebP, GIF, MP4");
    }
    if (detected.kind !== asset.kind) {
      throw errors.validation(
        [],
        `File content is a ${detected.kind}, not the declared ${asset.kind}`,
      );
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw errors.validation([], `File exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
    }
    const storageKey = await this.storageKeyOrThrow(id);
    // Demote to non-downloadable (a committed write) BEFORE the bytes change, so any failure or concurrent
    // read in the overwrite -> scan -> commit window stays fail-closed (AC-20.3): a link minted while the
    // asset was clean cannot serve the new, not-yet-scanned bytes.
    await this.repo.markPending(id, actorId);
    await this.storage.putObject(storageKey, bytes, detected.mimeType);
    const scanStatus = await this.scanner.scan(bytes);
    if (scanStatus !== "clean") await this.storage.deleteObject(storageKey); // never keep rejected bytes
    const row = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.setUploaded(
        id,
        { mimeType: detected.mimeType, sizeBytes: bytes.length, scanStatus },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "update",
          entityType: "media_asset",
          entityId: id,
          before: { scanStatus: asset.scanStatus },
          after: { scanStatus, sizeBytes: bytes.length, mimeType: detected.mimeType },
          maskImages: false,
        },
        tx,
      );
      return updated;
    });
    return toMediaAssetView(row);
  }

  /** Mint a 15-minute signed download link for a clean asset (AC-20). A non-clean asset is not downloadable. */
  async downloadUrlFor(id: string): Promise<MediaDownloadUrl> {
    const asset = await this.require(id);
    if (asset.scanStatus !== "clean") {
      throw errors.conflict("Media is not downloadable until a scan passes");
    }
    const signed = this.storage.signDownloadUrl(
      await this.storageKeyOrThrow(id),
      DOWNLOAD_TTL_SECONDS,
    );
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /**
   * Serve the bytes behind a signed download link: the signature must verify (not expired, key-bound) and
   * the asset must be clean, else the same 404 as absence (security.md). Access followed the owning record
   * when the link was minted; this endpoint honours that capability.
   */
  async streamBlob(
    storageKey: string,
    expiresAtEpoch: number,
    signature: string,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    if (!this.storage.verifyDownload(storageKey, expiresAtEpoch, signature))
      throw errors.notFound();
    const asset = await this.repo.findByStorageKey(storageKey);
    if (!asset || asset.scanStatus !== "clean") throw errors.notFound();
    return { bytes: await this.storage.getObject(storageKey), mimeType: asset.mimeType };
  }

  private async storageKeyOrThrow(id: string): Promise<string> {
    const key = await this.repo.storageKeyOf(id);
    if (!key) throw errors.notFound("No such media asset");
    return key;
  }

  private async require(id: string): Promise<MediaAssetRow> {
    const row = await this.repo.find(id);
    if (!row) throw errors.notFound("No such media asset");
    return row;
  }

  /**
   * GP-20 / AC-24.3: client, demo or public visibility needs owned, licensed or consent_obtained rights.
   * An allowlist, so a future rights status is non-publishable until explicitly permitted (fail closed).
   */
  private assertPublishable(visibility: MediaVisibility, rightsStatus: MediaRightsStatus): void {
    const isPublic = visibility === "client" || visibility === "demo" || visibility === "public";
    if (isPublic && !PUBLISHABLE_RIGHTS.has(rightsStatus)) {
      throw errors.conflict(
        "Media needs recorded consent or ownership before client, demo or public visibility (GP-20)",
      );
    }
  }
}
