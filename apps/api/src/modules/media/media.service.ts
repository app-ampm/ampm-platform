import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type MediaAssetCreateRequest,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaDownloadUrl,
  type MediaGalleryItem,
  type MediaListQuery,
  type MediaOwnerType,
  type MediaVideoItem,
  type MediaRemovedResponse,
  type MediaRightsStatus,
  type MediaVariant,
  type MediaVisibility,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { STORAGE_ADAPTER, type StorageAdapter } from "../../storage/storage.types.js";
import {
  CLIENT_VISIBILITIES,
  DEMO_VISIBILITIES,
  mimeForRef,
  PUBLISHABLE_RIGHTS,
} from "./media-content.js";
import { MediaUploadService } from "./media-upload.service.js";
import { MediaRepository, type MediaAssetRow, type MediaGalleryRow } from "./media.repository.js";
import { toMediaAssetView } from "./media.view.js";

/** The lifetime of a signed media download link (security.md: 15 minutes). */
const DOWNLOAD_TTL_SECONDS = 900;

/** A short, stable hex hash of an import reference — the deterministic half of an imported image's key. */
function refHash(ref: string): string {
  return createHash("sha256").update(ref).digest("hex").slice(0, 32);
}

/** The rights-and-visibility image audited on a media change — the fields GP-20 compliance turns on. */
function rightsImage(row: MediaAssetRow): Record<string, unknown> {
  return {
    visibility: row.visibility,
    rightsStatus: row.rightsStatus,
    consentSourceProjectId: row.consentSourceProjectId,
    consentDocumentId: row.consentDocumentId,
  };
}

/** A gallery row that has both derivatives and publishable rights — ready to serve to a client (AC-24.1). */
type GalleryReadyRow = MediaGalleryRow & { thumbnailKey: string; webKey: string };

function isGalleryReady(row: MediaGalleryRow): row is GalleryReadyRow {
  // Defence in depth: the visibility scope already excludes non-publishable rows, but a client gallery
  // re-checks the GP-20 rights gate and that the derivatives exist before it ever signs a link.
  return (
    PUBLISHABLE_RIGHTS.has(row.rightsStatus) && row.thumbnailKey !== null && row.webKey !== null
  );
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
    private readonly uploads: MediaUploadService,
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

  /**
   * Register a gallery image from the importer's by-reference column (feature 9.3 slice 5b). Idempotent per
   * (owner, ref): a PENDING, `internal`, `consent_required` image placeholder whose caption is the
   * reference — never client-visible until the media team uploads bytes and records rights (GP-20). Returns
   * whether a new row was created, so a re-run of the same import registers nothing again.
   */
  async registerImportedImage(
    ownerType: MediaOwnerType,
    ownerId: string,
    ref: string,
    actorId: string,
  ): Promise<{ created: boolean }> {
    // A deterministic object key per (owner, ref) is the idempotency handle — a re-run resolves the same key
    // and skips. The reference is an INTERNAL datum, so it is kept in the audit event (append-only), never in
    // the client-facing caption, which would otherwise reach the gallery once the asset is published (GP-20).
    const storageKey = `${ownerType}/${ownerId}/import-${refHash(ref)}`;
    if (await this.repo.findByAnyKey(storageKey)) return { created: false };
    const row = await this.repo.create(
      {
        ownerType,
        ownerId,
        kind: "image",
        mimeType: mimeForRef(ref),
        sizeBytes: 0, // a placeholder; the upload path sets the real size from the bytes (AC-20.2)
        visibility: "internal",
        rightsStatus: "consent_required",
      },
      storageKey,
      actorId,
    );
    // create() is audited by the controller interceptor on the API path; from the importer there is no
    // interceptor, so record the create here (security.md: a media create is audited). The ref lives here.
    await this.audit.record({
      action: "create",
      entityType: "media_asset",
      entityId: row.id,
      before: null,
      after: { source: "import", ref, scanStatus: "pending" },
      maskImages: false,
    });
    return { created: true };
  }

  async list(query: MediaListQuery): Promise<MediaAssetPage> {
    const { rows, nextCursor } = await this.repo.listByOwner(query.ownerType, query.ownerId, query);
    return { items: rows.map(toMediaAssetView), nextCursor };
  }

  async get(id: string): Promise<MediaAssetView> {
    return toMediaAssetView(await this.require(id));
  }

  /**
   * The gallery an owning module (Module C hotel discovery, feature 9.3c) shows a client/demo principal:
   * the owner's clean, rights-cleared media at or below the audience's visibility level (AC-24.4), each a
   * pair of short-lived signed links to its metadata-stripped derivatives (CP-05). No object key, rights,
   * visibility or scan state crosses the boundary — the caller gets pictures, not governance (security.md).
   */
  async clientGallery(
    ownerType: MediaOwnerType,
    ownerId: string,
    audience: "client" | "demo",
  ): Promise<MediaGalleryItem[]> {
    const visibilities = audience === "demo" ? DEMO_VISIBILITIES : CLIENT_VISIBILITIES;
    const rows = await this.repo.listGallery(ownerType, ownerId, [...visibilities]);
    return rows.filter(isGalleryReady).map((row) => this.toGalleryItem(row));
  }

  /**
   * One signed cover thumbnail per owner for a page of owners (card thumbnails; the Module C hotel list and
   * shortlist, feature 9.4). The cover is the owner's primary client-visible image — the lowest-sortOrder
   * clean, rights-cleared image at or below the audience's level (AC-24.4), the same photo and gate the
   * detail gallery's first tile uses — as a short-lived signed thumbnail link. Resolved in one batched read,
   * so a list of hotels costs a single media query, never one per card. An owner with no eligible image is
   * absent from the map, and its card falls back to the placeholder. No object key crosses the boundary.
   */
  async clientCovers(
    ownerType: MediaOwnerType,
    ownerIds: readonly string[],
    audience: "client" | "demo",
  ): Promise<Map<string, string>> {
    if (ownerIds.length === 0) return new Map();
    const visibilities = audience === "demo" ? DEMO_VISIBILITIES : CLIENT_VISIBILITIES;
    const rows = await this.repo.listCovers(
      ownerType,
      [...new Set(ownerIds)],
      [...visibilities],
      [...PUBLISHABLE_RIGHTS],
    );
    const covers = new Map<string, string>();
    for (const row of rows) {
      // The WHERE already excludes a null thumbnail key; this guard keeps the type honest (no `as`, api.md).
      if (row.thumbnailKey === null) continue;
      covers.set(
        row.ownerId,
        this.storage.signDownloadUrl(row.thumbnailKey, DOWNLOAD_TTL_SECONDS).url,
      );
    }
    return covers;
  }

  /**
   * The owner's client-visible videos (feature 9.3c), each a short-lived signed link to its ORIGINAL — a
   * video carries no web/thumbnail derivative, so there is no poster (AC-24.1 renders images only). Same
   * audience visibility ladder and GP-20 rights gate as the gallery; no object key crosses the boundary.
   */
  async clientVideos(
    ownerType: MediaOwnerType,
    ownerId: string,
    audience: "client" | "demo",
  ): Promise<MediaVideoItem[]> {
    const visibilities = audience === "demo" ? DEMO_VISIBILITIES : CLIENT_VISIBILITIES;
    const rows = await this.repo.listVideos(
      ownerType,
      ownerId,
      [...visibilities],
      [...PUBLISHABLE_RIGHTS],
    );
    return rows.map((row) => ({
      id: row.id,
      caption: row.caption,
      url: this.storage.signDownloadUrl(row.storageKey, DOWNLOAD_TTL_SECONDS).url,
    }));
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
   * Store an uploaded object's bytes against the asset. The content checks, fail-closed scan and derivative
   * generation are the MediaUploadService's pipeline (AC-20.2/.3, AC-24.1); this resolves the asset (404 if
   * absent) and delegates, so a non-existent id is refused before any work.
   */
  async uploadBytes(id: string, bytes: Buffer, actorId: string): Promise<MediaAssetView> {
    const asset = await this.require(id);
    return toMediaAssetView(await this.uploads.apply(id, asset, bytes, actorId));
  }

  /**
   * Mint a 15-minute signed link to one rendition of a clean asset (AC-20/AC-24.1). `original` is always
   * available; `web`/`thumbnail` resolve only once the derivatives exist (a video, or an asset uploaded
   * before derivatives, has none → 404). A non-clean asset is not downloadable at all.
   */
  async downloadUrlFor(id: string, variant: MediaVariant = "original"): Promise<MediaDownloadUrl> {
    const asset = await this.require(id);
    if (asset.scanStatus !== "clean") {
      throw errors.conflict("Media is not downloadable until a scan passes");
    }
    const keys = await this.keysOrThrow(id);
    const key =
      variant === "web"
        ? keys.webKey
        : variant === "thumbnail"
          ? keys.thumbnailKey
          : keys.storageKey;
    if (!key) throw errors.notFound("No such media variant");
    const signed = this.storage.signDownloadUrl(key, DOWNLOAD_TTL_SECONDS);
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /**
   * Serve the bytes behind a signed download link: the signature must verify (not expired, key-bound) and
   * the owning asset must be clean, else the same 404 as absence (security.md). The key may be the original
   * or a derivative — both resolve to the same asset, so one scan gate covers every rendition. Access
   * followed the owning record when the link was minted; this endpoint honours that capability.
   */
  async streamBlob(
    key: string,
    expiresAtEpoch: number,
    signature: string,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    if (!this.storage.verifyDownload(key, expiresAtEpoch, signature)) throw errors.notFound();
    const asset = await this.repo.findByAnyKey(key);
    if (!asset || asset.scanStatus !== "clean") throw errors.notFound();
    return { bytes: await this.storage.getObject(key), mimeType: asset.mimeType };
  }

  private toGalleryItem(row: GalleryReadyRow): MediaGalleryItem {
    return {
      id: row.id,
      kind: row.kind,
      caption: row.caption,
      thumbnailUrl: this.storage.signDownloadUrl(row.thumbnailKey, DOWNLOAD_TTL_SECONDS).url,
      webUrl: this.storage.signDownloadUrl(row.webKey, DOWNLOAD_TTL_SECONDS).url,
    };
  }

  private async keysOrThrow(
    id: string,
  ): Promise<{ storageKey: string; thumbnailKey: string | null; webKey: string | null }> {
    const keys = await this.repo.keysOf(id);
    if (!keys) throw errors.notFound("No such media asset");
    return keys;
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
