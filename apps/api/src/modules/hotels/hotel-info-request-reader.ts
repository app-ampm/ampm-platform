import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_INFO_REQUEST_EVENTS_SHOWN,
  isLiveHotelInfoRequestStatus,
  type HotelFormModeView,
  type HotelInfoRequestDetail,
  type HotelInfoRequestHistoryQuery,
  type HotelInfoRequestListQuery,
  type HotelInfoRequestPage,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { Principal } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { readsFullInfoRequests } from "./hotel-audience.js";
import { extensionLimit, firstExpiryOf } from "./hotel-info-request-expiry.js";
import {
  HotelInfoRequestsRepository,
  type RequestPage,
  type RequestRow,
} from "./hotel-info-requests.repository.js";
import { toRequestFull, toRequestSummary } from "./hotel-info-requests.view.js";

/** The answer for a request that does not exist, was deleted, or names nothing the caller may see. */
export const NO_SUCH_REQUEST = "No such hotel information request";

/**
 * Reads hotel information requests in the caller's model (D-188 §3): the inbox and a hotel's history as
 * summaries, and one request as the summary or, for a holder of `hotels.info_requests.update`, the full
 * view. The guard has checked `hotels.info_requests.read`.
 */
@Injectable()
export class HotelInfoRequestReader {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly config: ConfigService,
  ) {}

  /** The inbox, newest first; test requests only when asked for. */
  async list(query: HotelInfoRequestListQuery): Promise<HotelInfoRequestPage> {
    const page = await this.repo.list(
      { status: query.status, kind: query.kind, includeTests: query.includeTests },
      query.limit,
      query.cursor,
    );
    return this.summaries(page);
  }

  /** One hotel's requests, newest first: 404 when the hotel does not exist or was deleted. */
  async history(
    hotelId: string,
    query: HotelInfoRequestHistoryQuery,
  ): Promise<HotelInfoRequestPage> {
    if (!(await this.repo.hotelExists(hotelId))) throw errors.notFound("No such hotel");
    return this.summaries(await this.repo.listForHotel(hotelId, query.limit, query.cursor));
  }

  /**
   * One request in the caller's model; inside `tx`, as that transaction has written it (the create and
   * reissue answer the request as they committed it).
   *
   * @example
   * await reader.detail(id, principal); // SM, PM: the summary; SA, HT: the full view
   */
  async detail(
    id: string,
    principal: Principal,
    tx?: Prisma.TransactionClient,
  ): Promise<HotelInfoRequestDetail> {
    const row = await this.repo.findById(id, tx);
    if (!row) throw errors.notFound(NO_SUCH_REQUEST);
    const now = new Date();
    if (!readsFullInfoRequests(principal)) return toRequestSummary(row, now);
    // One after the other: inside a transaction both share its one connection.
    const events = await this.repo.latestEvents(row.id, HOTEL_INFO_REQUEST_EVENTS_SHOWN, tx);
    const limit = await this.extendableUntil(row, tx);
    return toRequestFull(row, events, limit, now);
  }

  /**
   * The latest expiry an extension may set: `maxExtensionDays` past the first expiry; null once the
   * request is no longer live, as nothing then extends it.
   */
  async extendableUntil(
    row: Pick<RequestRow, "id" | "status" | "expiresAt">,
    tx?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    if (!isLiveHotelInfoRequestStatus(row.status)) return null;
    const { maxExtensionDays } = await this.config.get("hotel_form.policy");
    const first = firstExpiryOf(await this.repo.firstExtensionDetail(row.id, tx), row.expiresAt);
    return extensionLimit(first, maxExtensionDays);
  }

  /**
   * The hotel form's mode alone (`GET /hotels-admin/hotel-form-mode`), read past the configuration cache
   * as every decision on it is (D-188 §6), so the staff sheets show what "Email it" will do now, not up
   * to five minutes ago. Nothing else of the policy leaves here.
   */
  async formMode(): Promise<HotelFormModeView> {
    const { mode } = await this.config.getFresh("hotel_form.policy");
    return { mode };
  }

  private summaries(page: RequestPage): HotelInfoRequestPage {
    const now = new Date();
    return {
      items: page.rows.map((row) => toRequestSummary(row, now)),
      nextCursor: page.nextCursor,
    };
  }
}
