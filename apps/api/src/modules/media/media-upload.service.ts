import { Inject, Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "../../storage/storage.types.js";
import { AV_SCANNER, type AvScanner } from "./av-scanner.js";
import { IMAGE_PROCESSOR, type ImageProcessor } from "./image.processor.js";
import {
  detectMedia,
  isDerivableImage,
  MAX_UPLOAD_BYTES,
  thumbnailKeyOf,
  THUMBNAIL_MAX_EDGE,
  webKeyOf,
  WEB_MAX_EDGE,
  type DerivativeKeys,
  type DetectedMedia,
  type Renditions,
} from "./media-content.js";
import { MediaRepository, type MediaAssetRow } from "./media.repository.js";

/**
 * The media upload pipeline (Module N, feature 9.3b/c): the write path that turns an asset's registered row
 * into stored, scanned, derived bytes. Kept apart from MediaService (which owns CRUD, the gallery and
 * download links) because it is a distinct responsibility with its own collaborators (the AV scanner and
 * image processor). By content (AC-20.2): the magic number decides the type (a renamed executable or a
 * kind mismatch is refused) and the size is bounded. Fail-closed (AC-20.3): only a `clean` asset is
 * downloadable, and the validation that can reject an upload runs BEFORE any stored state changes, so a
 * rejected or undecodable upload leaves an existing clean image exactly as it was.
 */
@Injectable()
export class MediaUploadService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly audit: AuditService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Inject(AV_SCANNER) private readonly scanner: AvScanner,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessor,
  ) {}

  /** Store, scan and derive an upload against an already-resolved asset; returns the updated row. */
  async apply(
    id: string,
    asset: MediaAssetRow,
    bytes: Buffer,
    actorId: string,
  ): Promise<MediaAssetRow> {
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
    // Validate the incoming bytes FULLY before any stored state changes: scan (AC-20.3) and, for an image,
    // decode into derivatives (AC-24.1) — both from memory. An infected or undecodable upload is decided
    // while the existing asset is untouched, so a 400 for undecodable bytes leaves a clean, published image
    // exactly as it was (no demote, overwrite or half-written audit) — like the earlier validation checks.
    const scanStatus = await this.scanner.scan(bytes);
    const renditions = scanStatus === "clean" ? await this.renderImage(bytes, detected) : null;
    const storageKey = await this.storageKeyOrThrow(id);
    // Only now mutate. Claim-and-demote in one atomic compare-and-swap (slice 5c): it serializes concurrent
    // uploads to this asset (a second upload gets a 409 rather than interleaving its writes and tearing the
    // rendition set) and demotes to `pending` + clears the derivative keys so the overwrite -> commit window
    // stays fail-closed (AC-20.3: a link minted while clean cannot serve not-yet-committed bytes). The claim
    // is released when the upload settles (commit) or fails (below); the stale TTL is the crash backstop.
    await this.claimOrConflict(id, actorId);
    try {
      const keys =
        scanStatus === "clean"
          ? await this.writeRenditions(storageKey, bytes, renditions, detected)
          : await this.discardBytes(storageKey); // infected: keep nothing, revoke every link
      return await this.commitUpload(
        id,
        asset.scanStatus,
        detected,
        bytes.length,
        scanStatus,
        keys,
        actorId,
      );
    } catch (error) {
      // The demotion committed but the upload did not: audit the transition so a client-visible demotion is
      // never observable without an audit event (security.md), and release the claim so a retry need not wait
      // out the stale TTL.
      await this.auditDemotion(id, asset.scanStatus);
      await this.repo.releaseUpload(id);
      throw error;
    }
  }

  /**
   * Derive the web + thumbnail renditions of a clean image IN MEMORY, rejecting bytes that sniffed as an
   * image but cannot be decoded (AC-20.2): a corrupt or crafted file must not be stored as a usable image.
   * Runs before any stored state changes, so the 400 leaves the existing asset untouched. A video or gif is
   * non-derivable and returns null (it keeps only its original).
   */
  private async renderImage(bytes: Buffer, detected: DetectedMedia): Promise<Renditions | null> {
    if (!isDerivableImage(detected)) return null;
    try {
      const [web, thumbnail] = await Promise.all([
        this.images.derive(bytes, WEB_MAX_EDGE),
        this.images.derive(bytes, THUMBNAIL_MAX_EDGE),
      ]);
      return { web, thumbnail };
    } catch {
      throw errors.validation([], `The file is not a decodable ${detected.kind}`);
    }
  }

  /** Store the original (always kept — AC-24.1) and its derivatives; a non-derivable file clears stale ones. */
  private async writeRenditions(
    storageKey: string,
    bytes: Buffer,
    renditions: Renditions | null,
    detected: DetectedMedia,
  ): Promise<DerivativeKeys> {
    await this.storage.putObject(storageKey, bytes, detected.mimeType);
    if (!renditions) {
      await Promise.all([
        this.storage.deleteObject(webKeyOf(storageKey)),
        this.storage.deleteObject(thumbnailKeyOf(storageKey)),
      ]);
      return {};
    }
    const webKey = webKeyOf(storageKey);
    const thumbnailKey = thumbnailKeyOf(storageKey);
    await Promise.all([
      this.storage.putObject(webKey, renditions.web, detected.mimeType),
      this.storage.putObject(thumbnailKey, renditions.thumbnail, detected.mimeType),
    ]);
    return { thumbnailKey, webKey };
  }

  /** The upload's row write and its audit, committed together (@SelfAudited has no interceptor backstop). */
  private commitUpload(
    id: string,
    beforeScan: MediaAssetRow["scanStatus"],
    detected: DetectedMedia,
    sizeBytes: number,
    scanStatus: MediaAssetRow["scanStatus"],
    keys: DerivativeKeys,
    actorId: string,
  ): Promise<MediaAssetRow> {
    return this.repo.transaction(async (tx) => {
      const updated = await this.repo.setUploaded(
        id,
        { mimeType: detected.mimeType, sizeBytes, scanStatus, ...keys },
        actorId,
        tx,
      );
      await this.audit.record(
        {
          action: "update",
          entityType: "media_asset",
          entityId: id,
          before: { scanStatus: beforeScan },
          after: {
            scanStatus,
            sizeBytes,
            mimeType: detected.mimeType,
            derived: keys.webKey !== undefined,
          },
          maskImages: false,
        },
        tx,
      );
      return updated;
    });
  }

  /** Record a demotion to `pending` that committed but whose upload then failed, so it is never unaudited. */
  private async auditDemotion(id: string, beforeScan: MediaAssetRow["scanStatus"]): Promise<void> {
    await this.audit.record({
      action: "update",
      entityType: "media_asset",
      entityId: id,
      before: { scanStatus: beforeScan },
      after: { scanStatus: "pending", derived: false },
      maskImages: false,
    });
  }

  /** A rejected upload keeps no bytes: remove the original and any derivatives from a prior clean upload. */
  private async discardBytes(storageKey: string): Promise<DerivativeKeys> {
    await Promise.all([
      this.storage.deleteObject(storageKey),
      this.storage.deleteObject(webKeyOf(storageKey)),
      this.storage.deleteObject(thumbnailKeyOf(storageKey)),
    ]);
    return {};
  }

  /** Acquire the per-asset upload claim or refuse (slice 5c): a concurrent upload to the same asset is a 409. */
  private async claimOrConflict(id: string, actorId: string): Promise<void> {
    if (!(await this.repo.claimUpload(id, actorId))) {
      throw errors.conflict("An upload is already in progress for this media asset");
    }
  }

  private async storageKeyOrThrow(id: string): Promise<string> {
    const keys = await this.repo.keysOf(id);
    if (!keys) throw errors.notFound("No such media asset");
    return keys.storageKey;
  }
}
