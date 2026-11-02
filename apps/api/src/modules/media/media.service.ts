import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  errors,
  type MediaAssetCreateRequest,
  type MediaAssetPage,
  type MediaAssetUpdateRequest,
  type MediaAssetView,
  type MediaListQuery,
  type MediaRemovedResponse,
  type MediaRightsStatus,
  type MediaVisibility,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { MediaRepository, type MediaAssetRow } from "./media.repository.js";
import { toMediaAssetView } from "./media.view.js";

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
  ) {}

  async create(request: MediaAssetCreateRequest, actorId: string): Promise<MediaAssetView> {
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
