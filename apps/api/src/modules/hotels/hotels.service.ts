import { Injectable } from "@nestjs/common";
import {
  errors,
  type DestinationBrowseResponse,
  type EntitlementModule,
  type HotelCompareQuery,
  type HotelCompareResponse,
  type HotelDetailView,
  type HotelListQuery,
  type HotelPage,
  type HotelReach,
  type SavedHotelListQuery,
  type SavedHotelPage,
  type SavedHotelRemovedResponse,
  type SavedHotelView,
} from "@ampm/core";
import type { Entitlements } from "@ampm/policy";

import { MediaService } from "../media/media.service.js";
import { entitlementGate } from "../../policy/entitlement-gate.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelReferencesService } from "./hotel-references.service.js";
import { HotelsRepository } from "./hotels.repository.js";
import {
  toDestinationBrowseItem,
  toHotelCompareItem,
  toHotelDetailView,
  toHotelView,
  toSavedHotelView,
} from "./hotels.view.js";

/** The media audience for a principal: a demo prospect sees demo/public, every real client the client set. */
function audienceFor(principal: Principal): "client" | "demo" {
  return principal.type === "demo" ? "demo" : "client";
}

/**
 * Module C discovery business rules: gate on the client's entitlements (hotel_discovery to browse/read,
 * saved_hotels=write to save), scope the catalogue by hotelReach, resolve the caller's OWN account before
 * a save (never trust an account id from the request — security.md). Staff/system principals carry no
 * entitlements, so they 404 here (denial equals absence); a staff hotel workspace is a separate, matrix-
 * keyed path (TW, not built yet).
 */
@Injectable()
export class HotelsService {
  constructor(
    private readonly hotels: HotelsRepository,
    private readonly media: MediaService,
    private readonly references: HotelReferencesService,
  ) {}

  async list(principal: Principal, query: HotelListQuery): Promise<HotelPage> {
    const { ent } = this.gate(principal, "hotel_discovery", false);
    const { rows, nextCursor } = await this.hotels.list(ent.hotelReach, query);
    // One batched Module N read resolves a client-visible cover thumbnail for the whole page (no N+1); a
    // hotel with no eligible image gets a null cover and its card shows the placeholder.
    const covers = await this.media.clientCovers(
      "hotel",
      rows.map((row) => row.id),
      audienceFor(principal),
    );
    return { items: rows.map((row) => toHotelView(row, covers.get(row.id) ?? null)), nextCursor };
  }

  /**
   * The destinations a client/demo principal may browse (CP-01/02, feature 9.4b): those with active hotels
   * in reach, each with that in-reach count (AC-04.5). Same entitlement gate and reach as the hotel list.
   */
  async browseDestinations(principal: Principal): Promise<DestinationBrowseResponse> {
    const { ent } = this.gate(principal, "hotel_discovery", false);
    const rows = await this.hotels.listDestinations(ent.hotelReach);
    return { items: rows.map(toDestinationBrowseItem) };
  }

  async get(principal: Principal, hotelId: string): Promise<HotelDetailView> {
    const { ent } = this.gate(principal, "hotel_discovery", false);
    const hotel = await this.hotels.findDetailInReach(ent.hotelReach, hotelId);
    if (!hotel) throw errors.notFound(); // outside reach or truly absent — the same 404
    // The gallery shows only media at or below the caller's visibility level (AC-24.4): a demo prospect
    // sees demo/public, a real client sees client/demo/public. Read through Module N, never its table.
    // References are same-module (Module C): only the consented, client-visible ones (GP-20). Both reads
    // run in parallel since the hotel is already confirmed in reach (the p95-under-400ms detail, AC-16).
    const [gallery, references] = await Promise.all([
      this.media.clientGallery("hotel", hotelId, audienceFor(principal)),
      this.references.clientReferences(hotelId),
    ]);
    return toHotelDetailView(hotel, gallery, references);
  }

  /**
   * Compare a handful of the caller's saved hotels (CP-06, feature 9.4c). Gated on hotel_discovery, not just
   * saved_hotels: a compare item carries the indicative rates, so an expired account (saved names only) must
   * not reach it. Compare is a view over the shortlist — only ids the caller has actually saved AND can see
   * in reach are returned, in the order asked; any other id is silently omitted (denial equals absence). No
   * gallery or references, so this never touches Module N — a light read that reuses the detail rate rows.
   */
  async compare(principal: Principal, query: HotelCompareQuery): Promise<HotelCompareResponse> {
    const { ent, userId } = this.gate(principal, "hotel_discovery", false);
    const accountId = await this.accountIdOrThrow(userId);
    const saved = await this.hotels.savedHotelIds(accountId, query.ids);
    const rows = await this.hotels.findDetailsInReach(
      ent.hotelReach,
      query.ids.filter((id) => saved.has(id)),
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = query.ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toHotelCompareItem(row)] : [];
    });
    return { items };
  }

  /**
   * 10.1 (Module D → C through this service): confirm a hotel is in the client's reach before an enquiry
   * targets it; an out-of-reach or absent hotel is the same 404 (denial equals absence, security.md).
   */
  async requireHotelInReach(reach: readonly HotelReach[], hotelId: string): Promise<void> {
    const hotel = await this.hotels.findInReach(reach, hotelId);
    if (!hotel) throw errors.notFound();
  }

  async listSaved(principal: Principal, query: SavedHotelListQuery): Promise<SavedHotelPage> {
    const { userId } = this.gate(principal, "saved_hotels", false);
    const accountId = await this.accountIdOrThrow(userId);
    const { rows, nextCursor } = await this.hotels.listSaved(accountId, query);
    // The shortlist card shows the same cover the search card does: one batched Module N read for the page.
    const covers = await this.media.clientCovers(
      "hotel",
      rows.map((row) => row.hotel.id),
      audienceFor(principal),
    );
    return {
      items: rows.map((row) => toSavedHotelView(row, covers.get(row.hotel.id) ?? null)),
      nextCursor,
    };
  }

  async save(principal: Principal, hotelId: string): Promise<SavedHotelView> {
    const { ent, userId } = this.gate(principal, "saved_hotels", true);
    const hotel = await this.hotels.findInReach(ent.hotelReach, hotelId);
    if (!hotel) throw errors.notFound(); // cannot save what you cannot see
    const accountId = await this.accountIdOrThrow(userId);
    const saved = await this.hotels.save(accountId, hotelId, userId);
    const covers = await this.media.clientCovers("hotel", [saved.hotel.id], audienceFor(principal));
    return toSavedHotelView(saved, covers.get(saved.hotel.id) ?? null);
  }

  async unsave(principal: Principal, hotelId: string): Promise<SavedHotelRemovedResponse> {
    const { userId } = this.gate(principal, "saved_hotels", true);
    const accountId = await this.accountIdOrThrow(userId);
    await this.hotels.unsave(accountId, hotelId, userId);
    return { hotelId };
  }

  /**
   * Only a client or the demo carries entitlements; anyone else, a missing module, or (for a write) a
   * read-only module is absence (404). Returns the entitlements and the caller's user id so the caller
   * need not re-narrow the principal.
   */
  private gate(
    principal: Principal,
    module: EntitlementModule,
    needWrite: boolean,
  ): { ent: Entitlements; userId: string } {
    return entitlementGate(principal, module, needWrite);
  }

  /** The caller's own account id, or a 404 when the client has none (portal.service.ts pattern). */
  private async accountIdOrThrow(userId: string): Promise<string> {
    const accountId = await this.hotels.accountIdForUser(userId);
    if (!accountId) throw errors.notFound();
    return accountId;
  }
}
