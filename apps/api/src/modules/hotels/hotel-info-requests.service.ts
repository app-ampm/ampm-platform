import { Injectable } from "@nestjs/common";
import {
  errors,
  isLiveHotelInfoRequestStatus,
  type HotelDuplicateHints,
  type HotelDuplicateHintsQuery,
  type HotelFormModeView,
  type HotelInfoRequestDetail,
  type HotelInfoRequestHistoryQuery,
  type HotelInfoRequestListQuery,
  type HotelInfoRequestPage,
  type HotelInfoRequestRevokeRequest,
  type HotelInfoRequestShareRecordRequest,
  type HotelInfoRequestUpdateRequest,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { duplicateHints, hasHintInput } from "./hotel-duplicate-hints.js";
import { nextExpiry } from "./hotel-info-request-expiry.js";
import {
  HotelInfoRequestJournal,
  staffActor,
  type RequestAudit,
} from "./hotel-info-request-journal.js";
import { HotelInfoRequestReader, NO_SUCH_REQUEST } from "./hotel-info-request-reader.js";
import { HotelInfoRequestRevoker } from "./hotel-info-request-revoker.js";
import { HotelInfoRequestsRepository, type RequestRow } from "./hotel-info-requests.repository.js";

/** The fields an update may change besides the expiry. */
const EDITABLE = ["displayLabel", "staffNote", "recipientName", "recipientEmail"] as const;
const CHANGED = "This request changed meanwhile: reload it and try again";
type EditableField = (typeof EDITABLE)[number];

/** The fields an update sends with a value they do not hold yet: a value sent again is no change. */
function changedFieldsOf(
  body: HotelInfoRequestUpdateRequest,
  current: RequestRow,
): Partial<Record<EditableField, string | null>> {
  const changed: Partial<Record<EditableField, string | null>> = {};
  for (const field of EDITABLE) {
    const value = body[field];
    if (value !== undefined && value !== current[field]) changed[field] = value;
  }
  return changed;
}

/** An update's audit: the names it changed, never their values, and the expiry before and after. */
function updateAudit(fields: readonly string[], from: Date, to: Date | null): RequestAudit {
  if (to === null) return { action: "update", after: { changedFields: [...fields] } };
  return {
    action: "update",
    before: { expiresAt: from.toISOString() },
    after: { changedFields: [...fields, "expiresAt"], expiresAt: to.toISOString() },
  };
}

/**
 * The staff routes of hotel information requests besides issuing a link (D-188 §3): the duplicate
 * hints, the inbox, a hotel's history and one request (through the reader, in the caller's model); and the
 * changes: the label, note, recipient and expiry; a recorded share; the revoke. Each change runs in one
 * transaction with its event and its audit, reading the request under its row's lock; a request that is
 * no longer live is read-only (409).
 */
@Injectable()
export class HotelInfoRequestsService {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly reader: HotelInfoRequestReader,
    private readonly journal: HotelInfoRequestJournal,
    private readonly revoker: HotelInfoRequestRevoker,
  ) {}

  /** The catalogue hotels a proposed new hotel may already be; none until a name or address is typed. */
  async duplicateHints(query: HotelDuplicateHintsQuery): Promise<HotelDuplicateHints> {
    if (!hasHintInput(query)) return { hints: [] };
    return { hints: duplicateHints(await this.repo.hintCandidates(), query) };
  }

  /** The hotel form's mode, fresh, for the staff sheets. */
  formMode(): Promise<HotelFormModeView> {
    return this.reader.formMode();
  }

  list(query: HotelInfoRequestListQuery): Promise<HotelInfoRequestPage> {
    return this.reader.list(query);
  }

  history(hotelId: string, query: HotelInfoRequestHistoryQuery): Promise<HotelInfoRequestPage> {
    return this.reader.history(hotelId, query);
  }

  get(id: string, principal: Principal): Promise<HotelInfoRequestDetail> {
    return this.reader.detail(id, principal);
  }

  /**
   * `PATCH /hotels-admin/info-requests/:id`: the label, note and recipient, and an extension held to
   * `maxExtensionDays` past the first expiry. An `updated` event names the fields changed; an
   * `expiry_extended` event records the expiry before and after.
   */
  async update(
    id: string,
    body: HotelInfoRequestUpdateRequest,
    principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    const actor = staffActor(principal);
    await this.repo.transaction(async (tx) => {
      const current = await this.requireLive(id, tx);
      const fields = changedFieldsOf(body, current);
      const names = Object.keys(fields);
      const limit = await this.reader.extendableUntil(current, tx);
      const now = new Date();
      const window = { current: current.expiresAt, limit: limit ?? current.expiresAt, now };
      const expiresAt = nextExpiry(body, window);
      if (names.length === 0 && expiresAt === null) return;
      const data = {
        ...fields,
        ...(expiresAt ? { expiresAt } : {}),
        updatedBy: staffId(principal),
      };
      const written = await this.repo.updateIf(id, { statuses: [current.status] }, data, tx);
      if (written !== 1) throw errors.conflict(CHANGED);
      if (names.length > 0) {
        await this.journal.event(
          { requestId: id, eventType: "updated", actor, at: now, detail: { fields: names } },
          tx,
        );
      }
      if (expiresAt) {
        const detail = { from: current.expiresAt.toISOString(), to: expiresAt.toISOString() };
        await this.journal.event(
          { requestId: id, eventType: "expiry_extended", actor, at: now, detail },
          tx,
        );
      }
      await this.journal.record(id, updateAudit(names, current.expiresAt, expiresAt), tx);
    });
    return this.reader.detail(id, principal);
  }

  /** `POST …/:id/share-record`: that staff passed the link on, and how; the link is never sent here. */
  async recordShare(
    id: string,
    body: HotelInfoRequestShareRecordRequest,
    principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    const actor = staffActor(principal);
    await this.repo.transaction(async (tx) => {
      const current = await this.requireLive(id, tx);
      const detail = {
        channel: body.channel,
        ...(body.note === undefined ? {} : { note: body.note }),
      };
      const at = new Date();
      await this.journal.event(
        { requestId: current.id, eventType: "share_recorded", actor, at, detail },
        tx,
      );
      await this.journal.record(
        current.id,
        { action: "share", after: { channel: body.channel } },
        tx,
      );
    });
    return this.reader.detail(id, principal);
  }

  /** `POST …/:id/revoke`: the §7 move to revoked, with the caller's reason. */
  async revoke(
    id: string,
    body: HotelInfoRequestRevokeRequest,
    principal: Principal,
  ): Promise<HotelInfoRequestDetail> {
    await this.repo.transaction(async (tx) => {
      const current = await this.repo.lockById(id, tx);
      if (!current) throw errors.notFound(NO_SUCH_REQUEST);
      await this.revoker.revokeByStaff(current, body.reason, principal, tx);
    });
    return this.reader.detail(id, principal);
  }

  /**
   * The request a change may write, read under its row's lock: a change that meets a revoke still
   * writing waits for it, then finds the request read-only, rather than landing on it.
   */
  private async requireLive(id: string, tx: Prisma.TransactionClient): Promise<RequestRow> {
    const current = await this.repo.lockById(id, tx);
    if (!current) throw errors.notFound(NO_SUCH_REQUEST);
    if (!isLiveHotelInfoRequestStatus(current.status)) {
      throw errors.conflict(`A ${current.status} request is read-only`);
    }
    return current;
  }
}
