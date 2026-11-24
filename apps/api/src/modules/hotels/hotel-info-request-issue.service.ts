import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  isLiveHotelInfoRequestStatus,
  normaliseWebAddress,
  type AppError,
  type HotelInfoRequestCreateRequest,
  type HotelInfoRequestDetail,
  type HotelInfoRequestLinkIssued,
  type HotelInfoRequestReissueRequest,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { ENV, type Env } from "../../env.js";
import { Prisma } from "../../generated/prisma/client.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { isSuperAdmin } from "../admin/capability-grants.js";
import { ConfigService } from "../admin/config/config.service.js";
import {
  createColumns,
  createdAudit,
  type Issue,
  type ResolvedTarget,
} from "./hotel-info-request-columns.js";
import { HotelInfoRequestJournal, staffActor } from "./hotel-info-request-journal.js";
import { addDays, hotelFormLinkUrl, mintLinkSecret } from "./hotel-info-request-link.js";
import { HotelInfoRequestMailer, type LinkEmail } from "./hotel-info-request-mailer.js";
import { HotelInfoRequestReader, NO_SUCH_REQUEST } from "./hotel-info-request-reader.js";
import { nextHotelInfoRequestReference } from "./hotel-info-request-reference.js";
import { HotelInfoRequestsRepository, type RequestRow } from "./hotel-info-requests.repository.js";

/*
 * Issuing a hotel information request's link (D-188 §3 and §4): creating a request, and reissuing its
 * link. Both answer the link once and store only its hash; both are audited with the action `share`, in
 * the transaction that writes them, and write their event there too; neither writes the link anywhere.
 * The email follows the commit, so the send job (inline in development and tests) reads a request that
 * exists. Once the request is committed its link is always answered: the answer carries the request as
 * the issuing transaction left it whenever it cannot be read again after the email, and the mailer
 * answers a failure of its own as `failed` rather than throwing.
 */

const TEST_REQUESTER = "Only the Super Admin can make a test request";
const TEST_TARGET = "A test request may go only to a draft hotel or a new hotel";
const NO_RECIPIENT = "Add the recipient's email before emailing the link";
const CHANGED = "This request changed meanwhile: reload it and try again";

/** The race-safe backstops of the one-live-request rules, which a 409 names when two creates race. */
const LIVE_INDEXES = [
  ["hotel_info_requests_hotel_live_key", "This hotel already has a live request"],
  ["hotel_info_requests_web_address_live_key", "A live request already proposes this web address"],
] as const;

/** The 409 for a unique violation of a live-request index; null for any other error. */
function liveConflictOf(error: unknown): AppError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
    return null;
  const text = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  const index = LIVE_INDEXES.find(([name]) => text.includes(name));
  return index ? errors.conflict(index[1]) : null;
}

/** The hotel's name as an email states it: the staff label, the catalogue's name, the proposed name. */
function emailNameOf(row: RequestRow): string {
  return row.displayLabel ?? row.hotel?.name ?? row.proposedName ?? row.reference;
}

/** A created request: its id, reference and hotel name, and the request as its transaction committed it. */
interface Created {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly committed: HotelInfoRequestDetail;
}

/** A rotated link: the request as read, the new generation, and the request as committed with it. */
interface Rotated {
  readonly current: RequestRow;
  readonly generation: number;
  readonly committed: HotelInfoRequestDetail;
}

@Injectable()
export class HotelInfoRequestIssueService {
  constructor(
    private readonly repo: HotelInfoRequestsRepository,
    private readonly journal: HotelInfoRequestJournal,
    private readonly mailer: HotelInfoRequestMailer,
    private readonly reader: HotelInfoRequestReader,
    private readonly config: ConfigService,
    @Inject(ENV) private readonly env: Env,
    private readonly logger: AppLogger,
  ) {}

  /**
   * `POST /hotels-admin/info-requests`: a request for an existing hotel or a proposed new one, its link
   * valid for `linkValidityDays`, emailed when asked and the mode admits it.
   */
  async create(
    body: HotelInfoRequestCreateRequest,
    principal: Principal,
  ): Promise<HotelInfoRequestLinkIssued> {
    if (body.isTest && !isSuperAdmin(principal)) throw errors.forbidden(TEST_REQUESTER);
    const { linkValidityDays } = await this.config.get("hotel_form.policy");
    const at = new Date();
    const link = mintLinkSecret();
    const actor = staffActor(principal);
    const issue = { actor, hash: link.hash, at, expiresAt: addDays(at, linkValidityDays) };
    const created = await this.insert(body, issue, principal);
    const email = {
      requestId: created.id,
      isTest: body.isTest,
      recipientEmail: body.recipientEmail ?? null,
      reference: created.reference,
      hotelName: body.displayLabel ?? created.name,
      expiresAt: issue.expiresAt,
      generation: 1,
    };
    return this.answer(link.secret, email, body.emailIt, principal, created.committed);
  }

  /**
   * `POST …/:id/reissue`: a new secret for a live request whose link has not expired; the old one stops
   * working. The expiry stays; the generation goes up by one.
   */
  async reissue(
    id: string,
    body: HotelInfoRequestReissueRequest,
    principal: Principal,
  ): Promise<HotelInfoRequestLinkIssued> {
    const link = mintLinkSecret();
    const { current, generation, committed } = await this.rotate(
      id,
      body.emailIt,
      link.hash,
      principal,
    );
    const email = {
      requestId: id,
      isTest: current.isTest,
      recipientEmail: current.recipientEmail,
      reference: current.reference,
      hotelName: emailNameOf(current),
      expiresAt: current.expiresAt,
      generation,
    };
    return this.answer(link.secret, email, body.emailIt, principal, committed);
  }

  /**
   * Emails the link when asked and admitted, then answers it, once, with the request in the caller's
   * model: as it stands after the email, else as the issuing transaction committed it.
   */
  private async answer(
    secret: string,
    email: Omit<LinkEmail, "url">,
    emailIt: boolean,
    principal: Principal,
    committed: HotelInfoRequestDetail,
  ): Promise<HotelInfoRequestLinkIssued> {
    const url = hotelFormLinkUrl(this.env.PUBLIC_SITE_URL, secret);
    const outcome = await this.mailer.sendLink({ ...email, url }, emailIt, staffActor(principal));
    const request = await this.standing(email.requestId, principal, committed);
    return { request, link: { url, expiresAt: email.expiresAt.toISOString() }, email: outcome };
  }

  /**
   * The request as it stands after its email (marked emailed, with that event); when it cannot be read
   * again, as its transaction committed it, so the link is answered whatever fails after the commit.
   */
  private async standing(
    id: string,
    principal: Principal,
    committed: HotelInfoRequestDetail,
  ): Promise<HotelInfoRequestDetail> {
    try {
      return await this.reader.detail(id, principal);
    } catch {
      this.logger.warn("hotel_form.link_answered_as_committed", { requestId: id });
      return committed;
    }
  }

  /** The new secret's hash in place of the old one, while the link is as read, with its event and audit. */
  private rotate(
    id: string,
    emailIt: boolean,
    hash: string,
    principal: Principal,
  ): Promise<Rotated> {
    return this.repo.transaction(async (tx) => {
      const current = await this.requireReissuable(id, emailIt, tx);
      const generation = current.tokenGeneration + 1;
      const at = new Date();
      const written = await this.repo.updateIf(
        id,
        { statuses: [current.status], generation: current.tokenGeneration },
        {
          tokenHash: hash,
          tokenGeneration: generation,
          linkIssuedAt: at,
          linkEmailedAt: null,
          updatedBy: staffId(principal),
        },
        tx,
      );
      if (written !== 1) throw errors.conflict(CHANGED);
      const actor = staffActor(principal);
      await this.journal.event(
        { requestId: id, eventType: "link_reissued", actor, at, detail: { generation } },
        tx,
      );
      const before = { tokenGeneration: current.tokenGeneration };
      const after = { issued: "reissued", tokenGeneration: generation };
      await this.journal.record(id, { action: "share", before, after }, tx);
      return { current, generation, committed: await this.reader.detail(id, principal, tx) };
    });
  }

  /**
   * A request whose link may be reissued, read under its row's lock: live, not expired, and with a
   * recipient if it is to be emailed.
   */
  private async requireReissuable(
    id: string,
    emailIt: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<RequestRow> {
    const current = await this.repo.lockById(id, tx);
    if (!current) throw errors.notFound(NO_SUCH_REQUEST);
    if (!isLiveHotelInfoRequestStatus(current.status)) {
      throw errors.conflict(`A ${current.status} request's link cannot be reissued`);
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      throw errors.conflict("This request's link has expired: extend it before reissuing it");
    }
    if (emailIt && current.recipientEmail === null) {
      throw errors.validation([{ path: "emailIt", message: NO_RECIPIENT }], NO_RECIPIENT);
    }
    return current;
  }

  /**
   * The request, its `created` event and its `share` audit, in one transaction, which also reads the
   * request back in the caller's model for the answer.
   */
  private async insert(
    body: HotelInfoRequestCreateRequest,
    issue: Issue,
    principal: Principal,
  ): Promise<Created> {
    try {
      return await this.repo.transaction(async (tx) => {
        const target = await this.resolveTarget(body, tx);
        const reference = await nextHotelInfoRequestReference(tx, issue.at);
        const id = await this.repo.create(
          createColumns(body, target, issue, reference, staffId(principal)),
          tx,
        );
        const detail = { generation: 1, expiresAt: issue.expiresAt.toISOString() };
        const event = {
          requestId: id,
          eventType: "created",
          actor: issue.actor,
          at: issue.at,
          detail,
        } as const;
        await this.journal.event(event, tx);
        await this.journal.record(id, createdAudit(body, target, issue, reference), tx);
        const committed = await this.reader.detail(id, principal, tx);
        return { id, reference, name: target.name, committed };
      });
    } catch (error) {
      throw liveConflictOf(error) ?? error;
    }
  }

  /**
   * The hotel a request names, locked so it cannot be deleted meanwhile, or a new hotel's proposal; and
   * the friendly 409 when a live request holds it already (the unique indexes are the race-safe backstop).
   */
  private resolveTarget(
    body: HotelInfoRequestCreateRequest,
    tx: Prisma.TransactionClient,
  ): Promise<ResolvedTarget> {
    return body.target === "existing"
      ? this.existingHotel(body.hotelId, body.isTest, tx)
      : this.newHotel(body, tx);
  }

  private async existingHotel(
    hotelId: string,
    isTest: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<ResolvedTarget> {
    const hotel = await this.repo.lockLiveHotel(hotelId, tx);
    if (!hotel) throw errors.validation([{ path: "hotelId", message: "Unknown hotel" }]);
    if (isTest && hotel.status !== "draft") {
      throw errors.validation([{ path: "isTest", message: TEST_TARGET }], TEST_TARGET);
    }
    const live = await this.repo.findLiveForHotel(hotel.id, tx);
    if (live) throw errors.conflict(`This hotel already has a live request (${live.reference})`);
    return { columns: { hotelId: hotel.id }, name: hotel.name };
  }

  private async newHotel(
    body: Extract<HotelInfoRequestCreateRequest, { target: "new" }>,
    tx: Prisma.TransactionClient,
  ): Promise<ResolvedTarget> {
    const destination = await this.repo.findDestination(body.proposedDestinationId, tx);
    if (!destination) {
      throw errors.validation([{ path: "proposedDestinationId", message: "Unknown destination" }]);
    }
    const key = normaliseWebAddress(body.proposedWebAddress);
    if (key === null) {
      throw errors.validation([{ path: "proposedWebAddress", message: "Unreadable web address" }]);
    }
    const live = await this.repo.findLiveForAddress(key, tx);
    if (live) {
      throw errors.conflict(`A live request already proposes this web address (${live.reference})`);
    }
    const columns = {
      hotelId: null,
      proposedName: body.proposedName,
      proposedDestinationId: destination.id,
      proposedWebAddress: body.proposedWebAddress,
      proposedWebAddressKey: key,
    };
    return { columns, name: body.proposedName };
  }
}
