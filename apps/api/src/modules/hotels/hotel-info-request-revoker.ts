import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { errors, type HotelInfoRequestStatus } from "@ampm/core";
import { canTransition, MATRIX, type PolicyPrincipal } from "@ampm/policy";

import { requestContext, type RequestContext } from "../../common/request-context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";
import {
  HotelInfoRequestJournal,
  type RequestActor,
  staffActor,
  SYSTEM_ACTOR,
} from "./hotel-info-request-journal.js";
import { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * Revoking a hotel information request: the move to `revoked` of permission-matrix §7 "Hotel information
 * request", which ends its link. Staff (SA, HT) revoke an open request or one awaiting changes, with a
 * reason (line 505); the System revokes a deleted hotel's live request, whatever its live status (lines
 * 505 and 506), inside the deletion's transaction, so a deleted hotel never keeps a live request.
 */

const MACHINE = "hotel_info_request";
/** The System as the request context's principal while it revokes for a deleted hotel. */
const HOTEL_DELETE: Principal = { type: "system", name: "hotel-delete" };
/** The reason a deleted hotel's request is revoked with. */
export const HOTEL_DELETED_REASON = "The hotel was deleted from the catalogue";

/** A request as a revocation reads it. */
interface Revocable {
  readonly id: string;
  readonly status: HotelInfoRequestStatus;
}

/** Who revokes, as the §7 machine and the history see them. */
interface Revocation {
  readonly actor: RequestActor;
  readonly principal: PolicyPrincipal;
  readonly reason: string;
  readonly cause: "staff" | "hotel_deleted";
}

/** Whether §7 lets any staff role revoke from a status, so a refusal there is the caller's (403). */
function staffMayRevokeFrom(status: HotelInfoRequestStatus): boolean {
  return MATRIX.transitions.some(
    (rule) =>
      rule.entity === MACHINE &&
      rule.from.includes(status) &&
      rule.to.includes("revoked") &&
      rule.roles.length > 0,
  );
}

/** Why a request cannot be revoked at all from its status (409). */
function notRevocable(status: HotelInfoRequestStatus): string {
  if (status === "revoked") return "This request is already revoked";
  if (status === "submitted" || status === "in_review") {
    return "A submitted request is with the reviewers: reject it rather than revoke it";
  }
  return `A ${status} request cannot be revoked`;
}

/** The deletion's own request id and address, with the System as the principal. */
function systemContextOf(current: RequestContext | undefined): RequestContext {
  return {
    requestId: current?.requestId ?? randomUUID(),
    ip: current?.ip ?? null,
    principal: HOTEL_DELETE,
    access: null,
  };
}

@Injectable()
export class HotelInfoRequestRevoker {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly journal: HotelInfoRequestJournal,
  ) {}

  /** `POST …/:id/revoke`: the caller's §7 move, with their reason, in the caller's transaction. */
  async revokeByStaff(
    request: Revocable,
    reason: string,
    principal: Principal,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const caller = toPolicyPrincipal(principal);
    await this.revoke(
      request,
      { actor: staffActor(principal), principal: caller, reason, cause: "staff" },
      tx,
    );
  }

  /**
   * Hotel `DELETE`, inside its transaction: locks the hotel's row first (so a request created meanwhile
   * waits, then finds the hotel gone), then revokes its live request, if any, as the System, audited as
   * the System under the deletion's request id.
   */
  async revokeForDeletedHotel(hotelId: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.repo.lockHotel(hotelId, tx);
    const live = await this.repo.findLiveForHotel(hotelId, tx);
    if (!live) return;
    const revocation: Revocation = {
      actor: SYSTEM_ACTOR,
      principal: { type: "system" },
      reason: HOTEL_DELETED_REASON,
      cause: "hotel_deleted",
    };
    await requestContext.run(systemContextOf(requestContext.get()), () =>
      this.revoke(live, revocation, tx),
    );
  }

  private async revoke(
    request: Revocable,
    by: Revocation,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!canTransition(by.principal, MACHINE, request.status, "revoked")) {
      if (by.principal.type === "staff" && staffMayRevokeFrom(request.status)) {
        throw errors.forbidden("You cannot revoke this request");
      }
      throw errors.conflict(notRevocable(request.status));
    }
    const at = new Date();
    const written = await this.repo.updateIf(
      request.id,
      { statuses: [request.status] },
      {
        status: "revoked",
        revokedAt: at,
        revokeReason: by.reason,
        ...(by.actor.kind === "staff" ? { updatedBy: by.actor.userId } : {}),
      },
      tx,
    );
    if (written !== 1)
      throw errors.conflict("This request changed meanwhile: reload it and try again");
    const detail = { fromStatus: request.status, cause: by.cause };
    await this.journal.event(
      { requestId: request.id, eventType: "revoked", actor: by.actor, at, detail },
      tx,
    );
    const audit = {
      before: { status: request.status },
      after: { status: "revoked", cause: by.cause },
    };
    await this.journal.record(request.id, { action: "update", ...audit }, tx);
  }
}
