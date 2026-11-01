import { Injectable } from "@nestjs/common";
import {
  errors,
  type EntitlementModule,
  type HotelListQuery,
  type HotelPage,
  type HotelView,
  type SavedHotelListQuery,
  type SavedHotelPage,
  type SavedHotelRemovedResponse,
  type SavedHotelView,
} from "@ampm/core";
import type { Entitlements } from "@ampm/policy";

import type { Principal } from "../../policy/principal.types.js";
import { HotelsRepository } from "./hotels.repository.js";
import { toHotelView, toSavedHotelView } from "./hotels.view.js";

/**
 * Module C discovery business rules: gate on the client's entitlements (hotel_discovery to browse/read,
 * saved_hotels=write to save), scope the catalogue by hotelReach, resolve the caller's OWN account before
 * a save (never trust an account id from the request — security.md). Staff/system principals carry no
 * entitlements, so they 404 here (denial equals absence); a staff hotel workspace is a separate, matrix-
 * keyed path (TW, not built yet).
 */
@Injectable()
export class HotelsService {
  constructor(private readonly hotels: HotelsRepository) {}

  async list(principal: Principal, query: HotelListQuery): Promise<HotelPage> {
    const { ent } = this.gate(principal, "hotel_discovery", false);
    const { rows, nextCursor } = await this.hotels.list(ent.hotelReach, query);
    return { items: rows.map(toHotelView), nextCursor };
  }

  async get(principal: Principal, hotelId: string): Promise<HotelView> {
    const { ent } = this.gate(principal, "hotel_discovery", false);
    const hotel = await this.hotels.findInReach(ent.hotelReach, hotelId);
    if (!hotel) throw errors.notFound(); // outside reach or truly absent — the same 404
    return toHotelView(hotel);
  }

  async listSaved(principal: Principal, query: SavedHotelListQuery): Promise<SavedHotelPage> {
    const { userId } = this.gate(principal, "saved_hotels", false);
    const accountId = await this.accountIdOrThrow(userId);
    const { rows, nextCursor } = await this.hotels.listSaved(accountId, query);
    return { items: rows.map(toSavedHotelView), nextCursor };
  }

  async save(principal: Principal, hotelId: string): Promise<SavedHotelView> {
    const { ent, userId } = this.gate(principal, "saved_hotels", true);
    const hotel = await this.hotels.findInReach(ent.hotelReach, hotelId);
    if (!hotel) throw errors.notFound(); // cannot save what you cannot see
    const accountId = await this.accountIdOrThrow(userId);
    const saved = await this.hotels.save(accountId, hotelId, userId);
    return toSavedHotelView(saved);
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
    if (principal.type !== "client" && principal.type !== "demo") throw errors.notFound();
    const ent = principal.entitlements;
    if (!ent.modules.includes(module)) throw errors.notFound();
    if (needWrite && ent.readOnlyModules.includes(module)) throw errors.notFound();
    return { ent, userId: principal.userId };
  }

  /** The caller's own account id, or a 404 when the client has none (portal.service.ts pattern). */
  private async accountIdOrThrow(userId: string): Promise<string> {
    const accountId = await this.hotels.accountIdForUser(userId);
    if (!accountId) throw errors.notFound();
    return accountId;
  }
}
