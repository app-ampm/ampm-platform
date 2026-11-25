import { Injectable } from "@nestjs/common";
import type { HotelInfoRequestEventType } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * A hotel information request's history and audit (D-188 §1 and §3): every change writes its event, and
 * its audit where security.md asks for one, in the transaction that makes the change. Neither ever holds
 * the link, its secret or its hash, nor the recipient's name or address: an event names the fields an
 * update changed, never their values.
 */

/**
 * Who made a change: a member of staff, the System (a deleted hotel's request), or a hotel person through
 * the form (D-189 §6), whose person row a code request does not have yet.
 */
export type RequestActor =
  | { readonly kind: "staff"; readonly userId: string }
  | { readonly kind: "system" }
  | { readonly kind: "hotel_person"; readonly personId: string | null };

/** The System, as a request event's actor. */
export const SYSTEM_ACTOR: RequestActor = { kind: "system" };

/**
 * The staff actor of a request.
 *
 * @example
 * staffActor(principal); // { kind: "staff", userId: principal.userId }
 */
export function staffActor(principal: Principal): RequestActor {
  return { kind: "staff", userId: staffId(principal) };
}

/** An event's detail: flat values only (core `hotelInfoRequestEventView`). */
export type RequestEventDetail = Readonly<
  Record<string, string | number | boolean | null | readonly string[]>
>;

/** One event of a request's history. */
export interface RequestEvent {
  readonly requestId: string;
  readonly eventType: HotelInfoRequestEventType;
  readonly actor: RequestActor;
  readonly at: Date;
  readonly detail?: RequestEventDetail;
}

/** What an audit of a request records: `share` for a link issued or shared, `update` otherwise. */
export interface RequestAudit {
  readonly action: "share" | "update";
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after: Readonly<Record<string, unknown>>;
}

@Injectable()
export class HotelInfoRequestJournal {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Writes an event inside the change's transaction. */
  async event(event: RequestEvent, tx: Prisma.TransactionClient): Promise<void> {
    const actorUserId = event.actor.kind === "staff" ? event.actor.userId : null;
    const actorPersonId = event.actor.kind === "hotel_person" ? event.actor.personId : null;
    await this.repo.addEvent(
      {
        requestId: event.requestId,
        eventType: event.eventType,
        actorKind: event.actor.kind,
        actorUserId,
        actorPersonId,
        ...(event.detail === undefined ? {} : { detail: { ...event.detail } }),
        occurredAt: event.at,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      tx,
    );
  }

  /**
   * Audits a change inside its transaction. The actor, request id and address come from the request
   * context, so a change the System makes for a deleted hotel is audited as the System's.
   */
  async record(
    requestId: string,
    audit: RequestAudit,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.audit.record(
      {
        action: audit.action,
        entityType: "hotel_info_request",
        entityId: requestId,
        before: audit.before,
        after: audit.after,
      },
      tx,
    );
  }
}
