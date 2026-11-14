import { Injectable } from "@nestjs/common";
import {
  errors,
  hotelEnquiryWithdrawableStatuses,
  isHotelEnquiryWithdrawable,
  type EntitlementModule,
  type HotelAssistanceRequestResponse,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryClientPage,
  type HotelEnquiryClientUpdateRequest,
  type HotelEnquiryClientView,
  type HotelEnquiryCreateRequest,
  type HotelEnquiryListQuery,
} from "@ampm/core";
import type { Entitlements } from "@ampm/policy";

import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { EventBus } from "../../jobs/event-bus.js";
import { entitlementGate } from "../../policy/entitlement-gate.js";
import type { Principal } from "../../policy/principal.types.js";
import { hotelAssistanceDemoRequested } from "../crm/leads/hotel-assistance.events.js";
import { HotelsService } from "../hotels/hotels.service.js";
import { EnquiryEventsRepository } from "./enquiry-events.repository.js";
import {
  EnquiriesRepository,
  type EnquiryRow,
  type EnquiryWriteData,
} from "./enquiries.repository.js";
import { toEnquiryClientDetailView, toEnquiryClientView } from "./enquiries.view.js";
import { isTerminalEnquiry } from "./enquiry-status.js";

/**
 * The CP-07 "request hotel assistance" boundary Module C stopped at, plus the client's view of their own
 * enquiries (CP-08). Gated on the `hotel_assistance` entitlement reach (an active subscription, an active
 * agreement or an active project opens it); staff/system and a trial/no-subscription client are absence
 * (404). A DEMO prospect is routed to Sales — a `demo` lead activity on the originating lead, never an
 * enquiry (P-7, AC-03.4) — through a domain event CRM handles. The client only ever sees CLIENT fields.
 */
@Injectable()
export class EnquiriesClientService {
  constructor(
    private readonly enquiries: EnquiriesRepository,
    private readonly events: EnquiryEventsRepository,
    private readonly hotels: HotelsService,
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async requestAssistance(
    principal: Principal,
    request: HotelEnquiryCreateRequest,
  ): Promise<HotelAssistanceRequestResponse> {
    const { ent, userId } = this.gate(principal, "hotel_assistance", true);
    const accountId = await this.accountIdOrThrow(userId);
    if (principal.type === "demo") {
      // Best-effort after the account is resolved: CRM logs the activity + notifies synchronously, but a
      // handler failure must not fail the prospect's request (the lead-enquiry notify pattern).
      await this.bus
        .emit(hotelAssistanceDemoRequested, {
          accountId,
          hotelId: request.hotelId,
          demoUserId: userId,
          requestNote: request.notesClient ?? request.functionsSummary ?? null,
        })
        .catch(() => this.logger.warn("consultancy.demo_request_failed", { accountId }));
      return { kind: "routed_to_sales" };
    }
    // A client may only enquire about a hotel they can actually reach (Module D → C via the C service).
    await this.hotels.requireHotelInReach(ent.hotelReach, request.hotelId);
    const open = await this.enquiries.findOpenForAccountHotel(accountId, request.hotelId);
    if (open) return { kind: "enquiry", enquiry: toEnquiryClientView(open) }; // idempotent (AC-26)
    const row = await this.createIdempotent(accountId, userId, request);
    return { kind: "enquiry", enquiry: toEnquiryClientView(row) };
  }

  /**
   * Create the enquiry, treating the partial-unique-index violation — a concurrent double-submit for the
   * same account+hotel (AC-26.1, the double-click the read-then-create cannot catch) — as an idempotent
   * hit: re-read and return the enquiry the racing request created, so one record results, not two.
   */
  private async createIdempotent(
    accountId: string,
    userId: string,
    request: HotelEnquiryCreateRequest,
  ): Promise<EnquiryRow> {
    try {
      return await this.create(accountId, userId, request);
    } catch (error) {
      if (!isOpenEnquiryConflict(error)) throw error;
      const existing = await this.enquiries.findOpenForAccountHotel(accountId, request.hotelId);
      if (!existing) throw error;
      return existing;
    }
  }

  async listOwn(
    principal: Principal,
    query: HotelEnquiryListQuery,
  ): Promise<HotelEnquiryClientPage> {
    const { userId } = this.gate(principal, "hotel_assistance", false);
    const accountId = await this.accountIdOrThrow(userId);
    const { rows, nextCursor } = await this.enquiries.listForAccount(accountId, query);
    return { items: rows.map(toEnquiryClientView), nextCursor };
  }

  async getOwn(principal: Principal, id: string): Promise<HotelEnquiryClientDetailView> {
    const { userId } = this.gate(principal, "hotel_assistance", false);
    const accountId = await this.accountIdOrThrow(userId);
    const row = await this.requireOwn(id, accountId);
    const events = await this.events.listByEnquiry(row.id);
    return toEnquiryClientDetailView(row, events);
  }

  async updateOwnNote(
    principal: Principal,
    id: string,
    request: HotelEnquiryClientUpdateRequest,
  ): Promise<HotelEnquiryClientView> {
    const { userId } = this.gate(principal, "hotel_assistance", true);
    const accountId = await this.accountIdOrThrow(userId);
    const row = await this.requireOwn(id, accountId);
    if (isTerminalEnquiry(row.status)) throw errors.conflict("A closed enquiry is read-only");
    await this.enquiries.updateNotesClient(id, request.notesClient, userId);
    return toEnquiryClientView(await this.requireOwn(id, accountId));
  }

  /**
   * Withdraw the client's own enquiry (CP-09): close it with outcome `withdrawn` while it is still in the
   * active pipeline. A confirmed or already-closed enquiry is not withdrawable (409) — the client app
   * hides the action there, and this is the server's backstop. Closing frees the account to enquire about
   * the hotel again (findOpenForAccountHotel excludes closed).
   */
  async withdrawOwn(principal: Principal, id: string): Promise<HotelEnquiryClientView> {
    const { userId } = this.gate(principal, "hotel_assistance", true);
    const accountId = await this.accountIdOrThrow(userId);
    const current = await this.requireOwn(id, accountId);
    if (isTerminalEnquiry(current.status)) throw errors.conflict("This enquiry is already closed");
    if (!isHotelEnquiryWithdrawable(current.status)) {
      throw errors.conflict("This enquiry can no longer be withdrawn");
    }
    await this.persistWithdrawal(current.id, userId);
    return toEnquiryClientView(await this.requireOwn(id, accountId));
  }

  /**
   * Close the enquiry withdrawn and append its client-visible timeline event, in one transaction. The
   * status write is guarded to the withdrawable statuses, so a withdraw that raced a staff confirmation or
   * a second withdraw moves 0 rows and is a 409 — never clobbering the row or doubling the event.
   */
  private async persistWithdrawal(id: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const moved = await this.enquiries.updateStatusFrom(
        id,
        hotelEnquiryWithdrawableStatuses,
        { status: "closed", outcome: "withdrawn", closedAt: new Date() },
        userId,
        tx,
      );
      if (moved === 0) throw errors.conflict("This enquiry can no longer be withdrawn");
      await this.events.create(
        {
          enquiryId: id,
          eventType: "status_change",
          occurredAt: new Date(),
          userId,
          summary: null,
          internalOnly: false,
          documentId: null,
        },
        userId,
        tx,
      );
    });
  }

  private async create(
    accountId: string,
    userId: string,
    request: HotelEnquiryCreateRequest,
  ): Promise<EnquiryRow> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.enquiries.create(
        buildEnquiryWrite(accountId, userId, request),
        userId,
        tx,
      );
      await this.events.create(
        {
          enquiryId: row.id,
          eventType: "submitted",
          occurredAt: new Date(),
          userId,
          summary: null,
          internalOnly: false,
          documentId: null,
        },
        userId,
        tx,
      );
      return row;
    });
  }

  private async requireOwn(id: string, accountId: string): Promise<EnquiryRow> {
    const row = await this.enquiries.findByIdForAccount(id, accountId);
    if (!row) throw errors.notFound();
    return row;
  }

  /** The shared client-entitlement gate (code.md reuse-first): anyone but a client/demo, a missing
   *  module, or — for a write — a read-only `hotel_assistance`, is absence (404). */
  private gate(
    principal: Principal,
    module: EntitlementModule,
    needWrite: boolean,
  ): { ent: Entitlements; userId: string } {
    return entitlementGate(principal, module, needWrite);
  }

  private async accountIdOrThrow(userId: string): Promise<string> {
    const accountId = await this.enquiries.accountIdForUser(userId);
    if (!accountId) throw errors.notFound();
    return accountId;
  }
}

/** The one-open-enquiry-per-account+hotel partial unique index was violated (a concurrent double-submit). */
function isOpenEnquiryConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildEnquiryWrite(
  accountId: string,
  userId: string,
  request: HotelEnquiryCreateRequest,
): EnquiryWriteData {
  return {
    accountId,
    hotelId: request.hotelId,
    requestedByUserId: userId,
    status: "submitted",
    dateFrom: new Date(request.dateFrom),
    dateTo: new Date(request.dateTo),
    datesFlexible: request.datesFlexible,
    guestEstimate: request.guestEstimate,
    roomsRequired: request.roomsRequired,
    functionsSummary: request.functionsSummary,
    contactPreference: request.contactPreference,
    notesClient: request.notesClient,
    submittedAt: new Date(),
  };
}
