import { Controller, Get } from "@nestjs/common";
import {
  savedHotelStaffListQuery,
  type SavedHotelStaffListQuery,
  type SavedHotelStaffPage,
} from "@ampm/core";

import type { Access } from "../../common/request-context.js";
import { ZodQuery } from "../../common/zod.js";
import { CurrentAccess, CurrentPrincipal, RequirePermission } from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { SavedHotelsStaffService } from "./saved-hotels-staff.service.js";

/**
 * Clients' saved hotels for staff (permission-matrix §5.3, `hotels.saved_hotels.read`: SA, SM and HT read
 * every client's), under the `hotels-admin` prefix beside the other staff hotel routes. One read-only
 * list: every client's saves, or one client's whole list for the client hub (`?accountId=`). PM's
 * assigned-wedding grant is not route-reachable yet (no wedding on the route until module E, the
 * service-agreements precedent); the repository already applies that scope. A plain read of CLIENT-class
 * rows, so it writes no audit event.
 */
@Controller("hotels-admin")
export class SavedHotelsStaffController {
  constructor(private readonly saved: SavedHotelsStaffService) {}

  @Get("saved-hotels")
  @RequirePermission("hotels.saved_hotels.read")
  list(
    @ZodQuery(savedHotelStaffListQuery) query: SavedHotelStaffListQuery,
    @CurrentPrincipal() principal: Principal,
    @CurrentAccess() access: Access,
  ): Promise<SavedHotelStaffPage> {
    return this.saved.list(principal, access, query);
  }
}
