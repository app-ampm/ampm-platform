import { Injectable } from "@nestjs/common";
import {
  errors,
  type DestinationCreateRequest,
  type DestinationUpdateRequest,
  type DestinationView,
  type HotelCreateRequest,
  type HotelStaffDetailView,
  type HotelStaffListQuery,
  type HotelStaffPage,
  type HotelUpdateRequest,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { slugify } from "./hotel-import.js";
import {
  HotelsAdminRepository,
  type DestinationUpdatePatch,
  type HotelUpdatePatch,
  type HotelWriteData,
  type StaffHotelRow,
} from "./hotels-admin.repository.js";
import {
  toDestinationView,
  toHotelStaffDetailView,
  toHotelStaffView,
} from "./hotels-admin.view.js";

/**
 * The staff hotel catalogue (HT/SA; feature 9.1). Reads are gated by the `hotels.*` read keys and writes
 * by the matching create/update/delete keys on the controller; this layer holds the rules — slug
 * resolution and uniqueness, the destination must exist — and records the update/delete audit (create is
 * audited by the interceptor through `@Audited`). The spreadsheet import is `HotelImportService`.
 */
@Injectable()
export class HotelsAdminService {
  constructor(
    private readonly repo: HotelsAdminRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: HotelStaffListQuery): Promise<HotelStaffPage> {
    const { rows, nextCursor } = await this.repo.list(
      { destinationId: query.destinationId, status: query.status, q: query.q },
      query.limit,
      query.cursor,
    );
    return { items: rows.map(toHotelStaffView), nextCursor };
  }

  async getDetail(hotelId: string): Promise<HotelStaffDetailView> {
    const row = await this.repo.findDetail(hotelId);
    if (!row) throw errors.notFound("No such hotel");
    return toHotelStaffDetailView(row);
  }

  async create(request: HotelCreateRequest, actorId: string): Promise<HotelStaffDetailView> {
    await this.requireDestination(request.destinationId);
    const slug = request.slug ?? slugify(request.name);
    if (await this.repo.slugExists(slug)) {
      throw errors.conflict(`A hotel with the slug "${slug}" already exists`);
    }
    const hotelId = await this.repo.createHotel(
      toHotelWriteData(request, request.destinationId, slug),
      actorId,
    );
    return this.getDetail(hotelId);
  }

  async update(
    hotelId: string,
    request: HotelUpdateRequest,
    actorId: string,
  ): Promise<HotelStaffDetailView> {
    const current = await this.require(hotelId);
    if (request.destinationId !== undefined) await this.requireDestination(request.destinationId);
    const patch = toHotelUpdatePatch(request);
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
    return this.getDetail(hotelId);
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

  async listDestinations(): Promise<{ items: DestinationView[] }> {
    const rows = await this.repo.listDestinations();
    return { items: rows.map(toDestinationView) };
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

  private async requireDestination(destinationId: string): Promise<void> {
    if (!(await this.repo.findDestinationById(destinationId))) {
      throw errors.validation([{ path: "destinationId", message: "Unknown destination" }]);
    }
  }
}

/** A create request plus its resolved destination and slug, as the row the repository writes. */
function toHotelWriteData(
  request: HotelCreateRequest,
  destinationId: string,
  slug: string,
): HotelWriteData {
  return {
    destinationId,
    slug,
    name: request.name,
    brand: request.brand ?? null,
    starCategory: request.starCategory ?? null,
    address: request.address ?? null,
    latitude: request.latitude ?? null,
    longitude: request.longitude ?? null,
    descriptionClient: request.descriptionClient ?? null,
    website: request.website ?? null,
    status: request.status,
    demoVisible: request.demoVisible,
    publicShowcase: request.publicShowcase,
    internalRating: request.internalRating ?? null,
    internalNotes: request.internalNotes ?? null,
    totalRooms: request.totalRooms ?? null,
    streetViewRef: request.streetViewRef ?? null,
  };
}

/** Only the fields the patch actually set, so an update never overwrites an unmentioned column. */
function toHotelUpdatePatch(request: HotelUpdateRequest): HotelUpdatePatch {
  const patch: HotelUpdatePatch = {};
  if (request.destinationId !== undefined) patch.destinationId = request.destinationId;
  if (request.name !== undefined) patch.name = request.name;
  if (request.brand !== undefined) patch.brand = request.brand ?? null;
  if (request.starCategory !== undefined) patch.starCategory = request.starCategory ?? null;
  if (request.address !== undefined) patch.address = request.address ?? null;
  if (request.latitude !== undefined) patch.latitude = request.latitude ?? null;
  if (request.longitude !== undefined) patch.longitude = request.longitude ?? null;
  if (request.descriptionClient !== undefined)
    patch.descriptionClient = request.descriptionClient ?? null;
  if (request.website !== undefined) patch.website = request.website ?? null;
  if (request.status !== undefined) patch.status = request.status;
  if (request.demoVisible !== undefined) patch.demoVisible = request.demoVisible;
  if (request.publicShowcase !== undefined) patch.publicShowcase = request.publicShowcase;
  if (request.internalRating !== undefined) patch.internalRating = request.internalRating ?? null;
  if (request.internalNotes !== undefined) patch.internalNotes = request.internalNotes ?? null;
  if (request.totalRooms !== undefined) patch.totalRooms = request.totalRooms ?? null;
  if (request.streetViewRef !== undefined) patch.streetViewRef = request.streetViewRef ?? null;
  return patch;
}

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
