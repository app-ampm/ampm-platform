import { Injectable } from "@nestjs/common";
import type {
  SavedHotelStaffListQuery,
  SavedHotelStaffPage,
  SavedHotelStaffView,
} from "@ampm/core";

import type { Access } from "../../common/request-context.js";
import { recordScope } from "../../db/scoping.js";
import type { Principal } from "../../policy/principal.types.js";
import {
  SavedHotelsStaffRepository,
  type SavedHotelStaffRow,
} from "./saved-hotels-staff.repository.js";

/** One saved hotel as the staff contract carries it. */
export function toSavedHotelStaffView(row: SavedHotelStaffRow): SavedHotelStaffView {
  return {
    id: row.id,
    hotel: {
      id: row.hotel.id,
      name: row.hotel.name,
      starCategory: row.hotel.starCategory,
      status: row.hotel.status,
      destinationName: row.hotel.destination.name,
    },
    account: { id: row.account.id, name: row.account.name },
    note: row.note,
    savedAt: row.createdAt.toISOString(),
  };
}

/**
 * The staff read of clients' saved hotels (`hotels.saved_hotels.read`): what each client shortlisted while
 * exploring hotels, so the team can follow their interest. Read-only; the client alone changes the list.
 * The guard decided the key and its scope before the read; the repository applies that scope.
 */
@Injectable()
export class SavedHotelsStaffService {
  constructor(private readonly saved: SavedHotelsStaffRepository) {}

  async list(
    principal: Principal,
    access: Access,
    query: SavedHotelStaffListQuery,
  ): Promise<SavedHotelStaffPage> {
    const { rows, nextCursor } = await this.saved.list(recordScope(principal, access.scope), query);
    return { items: rows.map(toSavedHotelStaffView), nextCursor };
  }
}
