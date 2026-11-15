import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_ENQUIRY_OPEN_STATUSES,
  type HotelEnquiryAssignee,
  type HotelEnquiryAssigneeFilter,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { PrincipalService } from "../../policy/principal.service.js";
import type { Principal } from "../../policy/principal.types.js";

/**
 * What it takes to hold an enquiry: to be allowed to work every enquiry, not only one's own weddings'.
 * The Super Admin and the hotel team hold it in the matrix (a project manager's grant is scoped to their
 * weddings, so it does not); a custom role holds it once granted `consultancy.enquiries.update:all`.
 */
export const ENQUIRY_HOLDER_KEY = "consultancy.enquiries.update";

/**
 * The staff queue's holder filter as a `where` on hotel_enquiries: the open enquiries the reader holds,
 * or the open ones nobody holds. Open work only, so each list matches the pipeline's count beside it. A
 * reader with no user id (the system) holds nothing.
 */
export function assigneeWhere(
  filter: HotelEnquiryAssigneeFilter | undefined,
  principal: Principal,
): Prisma.HotelEnquiryWhereInput {
  if (filter === undefined) return {};
  const open = { status: { in: [...HOTEL_ENQUIRY_OPEN_STATUSES] } };
  if (filter === "unassigned") return { ...open, assignedUserId: null };
  const me = principal.type === "system" ? null : principal.userId;
  return me === null ? { id: { in: [] } } : { ...open, assignedUserId: me };
}

/**
 * Who an enquiry can be handed to, and the check that a chosen owner is one of them. The people come
 * from the policy kernel's `staffHolding` (the same engine and role resolution as a signed-in request,
 * custom roles included), so the picker and the server agree on who qualifies.
 */
@Injectable()
export class EnquiryAssignmentService {
  constructor(private readonly principals: PrincipalService) {}

  /** The active staff who may hold an enquiry, by name. */
  async assignees(): Promise<HotelEnquiryAssignee[]> {
    return this.principals.staffHolding(ENQUIRY_HOLDER_KEY);
  }

  /**
   * Refuses an owner who cannot hold an enquiry — a client, a disabled user, a role without the grant or
   * an id that names no one — as a 400 on `assignedUserId`, so the assignee is never a dangling or
   * powerless id. Clearing the owner (null) and keeping the current one always pass.
   */
  async assertAssignable(
    assignedUserId: string | null | undefined,
    current: string | null,
  ): Promise<void> {
    if (assignedUserId === undefined || assignedUserId === null) return;
    if (assignedUserId === current) return;
    const found = await this.principals.staffHolding(ENQUIRY_HOLDER_KEY, [assignedUserId]);
    if (found.length === 0) {
      const message = "Choose someone on the hotel team who can work this enquiry";
      throw errors.validation([{ path: "assignedUserId", message }], message);
    }
  }
}
