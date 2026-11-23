import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_CUISINE_OTHER,
  type DestinationCreateRequest,
  type DestinationList,
  type DestinationUpdateRequest,
  type DestinationView,
  type ErrorDetail,
  type HotelCreateRequest,
  type HotelCuisineOptionsView,
  type HotelStaffDetail,
  type HotelStaffListQuery,
  type HotelStaffPage,
  type HotelUpdateRequest,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { hotelAudienceOf, requireNotesWrite } from "./hotel-audience.js";
import { slugify } from "./hotel-import.js";
import {
  allowedCuisines,
  checkPostalCode,
  CUISINE_REFUSED,
  keptPostalCodeProblem,
  resolveCuisines,
} from "./hotel-profile-rules.js";
import { toStringList } from "./hotel-string-lists.js";
import { toHotelUpdatePatch, toHotelWriteData } from "./hotel-write.js";
import {
  HotelsAdminRepository,
  type DestinationRow,
  type DestinationUpdatePatch,
  type StaffHotelRow,
} from "./hotels-admin.repository.js";
import {
  toDestinationListItem,
  toDestinationView,
  toHotelStaffDetail,
  toHotelStaffListItem,
} from "./hotels-admin.view.js";

/**
 * The staff hotel catalogue (feature 9.1). Reads are gated by the `hotels.*` read keys and writes by the
 * matching create/update/delete keys on the controller; this layer holds the rules — slug resolution and
 * uniqueness, the destination must exist, the internal rating and notes are written only on their own
 * key, a postal code fits its destination's country and a cuisine is one the configuration offers (D-178)
 * — answers every hotel in the model of the caller's audience (D-171), and records the update/delete
 * audit (create is audited by the interceptor through `@Audited`). The import is `HotelImportService`.
 */
@Injectable()
export class HotelsAdminService {
  constructor(
    private readonly repo: HotelsAdminRepository,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(query: HotelStaffListQuery, principal: Principal): Promise<HotelStaffPage> {
    const audience = hotelAudienceOf(principal);
    const { rows, nextCursor } = await this.repo.list(
      { destinationId: query.destinationId, status: query.status, q: query.q },
      query.limit,
      query.cursor,
    );
    return { items: rows.map((row) => toHotelStaffListItem(row, audience)), nextCursor };
  }

  async getDetail(hotelId: string, principal: Principal): Promise<HotelStaffDetail> {
    const row = await this.repo.findDetail(hotelId);
    if (!row) throw errors.notFound("No such hotel");
    return toHotelStaffDetail(row, hotelAudienceOf(principal));
  }

  /** A create sets the internal rating or notes when it gives either a value (null is the default). */
  async create(request: HotelCreateRequest, principal: Principal): Promise<HotelStaffDetail> {
    requireNotesWrite(principal, request.internalRating != null || request.internalNotes != null);
    const destination = await this.requireDestination(request.destinationId);
    const fields = await this.checkProfile(request, async () => destination.country, NEW_HOTEL);
    const slug = request.slug ?? slugify(request.name);
    if (await this.repo.slugExists(slug)) {
      throw errors.conflict(`A hotel with the slug "${slug}" already exists`);
    }
    const hotelId = await this.repo.createHotel(
      toHotelWriteData(fields, request.destinationId, slug),
      staffId(principal),
    );
    return this.getDetail(hotelId, principal);
  }

  /** An update sets the internal rating or notes when it names either, a null clearing it. */
  async update(
    hotelId: string,
    request: HotelUpdateRequest,
    principal: Principal,
  ): Promise<HotelStaffDetail> {
    const actorId = staffId(principal);
    const current = await this.require(hotelId);
    requireNotesWrite(
      principal,
      request.internalRating !== undefined || request.internalNotes !== undefined,
    );
    const patch = toHotelUpdatePatch(await this.checkUpdate(request, current));
    await this.repo.transaction(async (tx) => {
      await this.repo.updateHotel(hotelId, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel",
          entityId: hotelId,
          before: { name: current.name, status: current.status, demoVisible: current.demoVisible },
          after: {
            name: request.name ?? current.name,
            status: request.status ?? current.status,
            demoVisible: request.demoVisible ?? current.demoVisible,
          },
          maskImages: false,
        },
        tx,
      );
    });
    return this.getDetail(hotelId, principal);
  }

  async remove(hotelId: string, actorId: string): Promise<{ id: string }> {
    const current = await this.require(hotelId);
    await this.repo.transaction(async (tx) => {
      await this.repo.softDeleteHotel(hotelId, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "hotel",
          entityId: hotelId,
          before: { status: current.status, deletedAt: null },
          after: { deleted: true },
          maskImages: false,
        },
        tx,
      );
    });
    return { id: hotelId };
  }

  /** The cuisine choices for the staff editor (configuration `hotel.cuisine_options`) and "Other". */
  async cuisineOptions(): Promise<HotelCuisineOptionsView> {
    const { options } = await this.config.get("hotel.cuisine_options");
    return { options, other: HOTEL_CUISINE_OTHER };
  }

  /** Every destination with the count of its hotels (TW-20): the whole reference set, name-ordered. */
  async listDestinations(): Promise<DestinationList> {
    const rows = await this.repo.listDestinations();
    return { items: rows.map(toDestinationListItem) };
  }

  async createDestination(
    request: DestinationCreateRequest,
    actorId: string,
  ): Promise<DestinationView> {
    const slug = request.slug ?? slugify(request.name);
    if (await this.repo.findDestinationBySlug(slug)) {
      throw errors.conflict(`A destination with the slug "${slug}" already exists`);
    }
    const id = await this.repo.createDestination(
      {
        name: request.name,
        slug,
        region: request.region ?? null,
        state: request.state ?? null,
        country: request.country,
        description: request.description ?? null,
        status: request.status,
        publicVisible: request.publicVisible,
      },
      actorId,
    );
    const row = await this.repo.findDestinationById(id);
    if (!row) throw errors.notFound("No such destination");
    return toDestinationView(row);
  }

  async updateDestination(
    destinationId: string,
    request: DestinationUpdateRequest,
    actorId: string,
  ): Promise<DestinationView> {
    const current = await this.repo.findDestinationById(destinationId);
    if (!current) throw errors.notFound("No such destination");
    await this.repo.updateDestination(destinationId, toDestinationPatch(request), actorId);
    await this.audit.record({
      action: "update",
      entityType: "destination",
      entityId: destinationId,
      before: {
        name: current.name,
        status: current.status,
        publicVisible: current.publicVisible,
      },
      after: {
        name: request.name ?? current.name,
        status: request.status ?? current.status,
        publicVisible: request.publicVisible ?? current.publicVisible,
      },
      maskImages: false,
    });
    const row = await this.repo.findDestinationById(destinationId);
    if (!row) throw errors.notFound("No such destination");
    return toDestinationView(row);
  }

  private async require(hotelId: string): Promise<StaffHotelRow> {
    const row = await this.repo.findById(hotelId);
    if (!row) throw errors.notFound("No such hotel");
    return row;
  }

  /**
   * An update's fields once the profile rules pass, read against where the hotel will be: a destination
   * the request moves it to must exist, and a move without a new postal code checks the one it keeps.
   */
  private async checkUpdate(
    request: HotelUpdateRequest,
    current: StaffHotelRow,
  ): Promise<HotelUpdateRequest> {
    const moved =
      request.destinationId === undefined
        ? null
        : await this.requireDestination(request.destinationId);
    const country = async () =>
      (moved ?? (await this.repo.findDestinationById(current.destinationId)))?.country ?? null;
    const movesAway = moved !== null && moved.id !== current.destinationId;
    return this.checkProfile(request, country, {
      cuisines: toStringList(current.cuisines),
      keptPostalCode: movesAway ? current.postalCode : null,
    });
  }

  private async requireDestination(destinationId: string): Promise<DestinationRow> {
    const destination = await this.repo.findDestinationById(destinationId);
    if (!destination) {
      throw errors.validation([{ path: "destinationId", message: "Unknown destination" }]);
    }
    return destination;
  }

  /**
   * The request's fields as written, once the rules the schema cannot hold pass (D-178): a postal code,
   * spaces removed, fits its destination's country (looked up only when one is sent, or when a move
   * keeps the stored one), and each cuisine is configured, "Other" or already the hotel's, stored in its
   * configured spelling. Otherwise a 400 naming every refused field.
   */
  private async checkProfile<T extends ProfileRuleFields>(
    fields: T,
    country: () => Promise<string | null>,
    stored: StoredProfile,
  ): Promise<T> {
    const problems: ErrorDetail[] = [];
    let checked = fields;
    if (typeof fields.postalCode === "string") {
      const { postalCode, problem } = checkPostalCode(fields.postalCode, await country());
      if (problem) problems.push({ path: "postalCode", message: problem });
      checked = { ...checked, postalCode };
    } else if (fields.postalCode === undefined && stored.keptPostalCode !== null) {
      const problem = keptPostalCodeProblem(stored.keptPostalCode, await country());
      if (problem) problems.push({ path: "postalCode", message: problem });
    }
    if (fields.cuisines) {
      const { options } = await this.config.get("hotel.cuisine_options");
      const allowed = allowedCuisines(options, stored.cuisines);
      const { labels, unknown } = resolveCuisines(fields.cuisines, allowed);
      for (const index of unknown)
        problems.push({ path: `cuisines.${index}`, message: CUISINE_REFUSED });
      checked = { ...checked, cuisines: labels };
    }
    if (problems.length > 0) throw errors.validation(problems);
    return checked;
  }
}

/** The request fields the profile rules read. */
interface ProfileRuleFields {
  readonly postalCode?: string | null;
  readonly cuisines?: string[] | null;
}

/** What the profile rules read from the hotel as stored. */
interface StoredProfile {
  /** Its cuisine labels, which stay allowed after AMPM drops them from the options. */
  readonly cuisines: readonly string[] | null;
  /** Its postal code when the write moves it to another destination without a new one. */
  readonly keptPostalCode: string | null;
}

/** A create has nothing stored. */
const NEW_HOTEL: StoredProfile = { cuisines: null, keptPostalCode: null };

/** The destination fields a patch set (the slug is immutable, so it is never part of an update). */
function toDestinationPatch(request: DestinationUpdateRequest): DestinationUpdatePatch {
  const patch: DestinationUpdatePatch = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.region !== undefined) patch.region = request.region ?? null;
  if (request.state !== undefined) patch.state = request.state ?? null;
  if (request.country !== undefined) patch.country = request.country;
  if (request.description !== undefined) patch.description = request.description ?? null;
  if (request.status !== undefined) patch.status = request.status;
  if (request.publicVisible !== undefined) patch.publicVisible = request.publicVisible;
  return patch;
}
