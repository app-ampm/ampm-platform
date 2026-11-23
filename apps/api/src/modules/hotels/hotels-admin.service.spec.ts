import { describe, expect, it, vi } from "vitest";

import {
  hotelStaffDetailContactsView,
  hotelStaffDetailFullView,
  hotelStaffDetailNotesView,
  hotelStaffDetailView,
  hotelStaffNotesView,
  hotelStaffView,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import {
  HotelsAdminRepository,
  type StaffHotelDetailRow,
  type StaffHotelRow,
} from "./hotels-admin.repository.js";
import { HotelsAdminService } from "./hotels-admin.service.js";

const HOTEL = "0192f1a0-0000-7000-8000-0000000000a1";
const DESTINATION = "0192f1a0-0000-7000-8000-0000000000a2";

/** A synthetic catalogue hotel as the repository reads it, with internal notes and one contact. */
function hotelRow(): StaffHotelDetailRow {
  return {
    id: HOTEL,
    destinationId: DESTINATION,
    name: "Synthetic Lake Hotel",
    slug: "synthetic-lake-hotel",
    brand: null,
    starCategory: "5",
    address: null,
    latitude: null,
    longitude: null,
    descriptionClient: null,
    website: null,
    status: "active",
    demoVisible: false,
    publicShowcase: false,
    internalRating: 4,
    internalNotes: "Synthetic note",
    totalRooms: 40,
    streetViewRef: null,
    facilities: null,
    lastVerifiedAt: null,
    destination: {
      id: DESTINATION,
      name: "Synthetic Destination",
      slug: "synthetic-destination",
      region: null,
      state: null,
      country: "India",
      description: null,
      status: "active",
      publicVisible: false,
    },
    rooms: [],
    venues: [],
    contacts: [
      {
        id: "0192f1a0-0000-7000-8000-0000000000a3",
        hotelId: HOTEL,
        name: "Test Contact",
        roleTitle: null,
        phone: null,
        email: "contact@example.com",
        isPrimary: true,
      },
    ],
  };
}

function build() {
  const row = hotelRow();
  const profile: StaffHotelRow = { ...row };
  const repo = {
    findDetail: vi.fn(async () => row),
    findById: vi.fn(async () => profile),
    list: vi.fn(async () => ({ rows: [profile], nextCursor: null })),
    findDestinationById: vi.fn(async () => row.destination),
    slugExists: vi.fn(async () => false),
    createHotel: vi.fn(async () => HOTEL),
    updateHotel: vi.fn(async () => undefined),
    transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new HotelsAdminService(
    repo as unknown as HotelsAdminRepository,
    audit as unknown as AuditService,
  );
  return { service, repo };
}

const CUSTOM_CONTACTS = ["hotels.hotel_contacts.read:all"];
const CUSTOM_NOTES = ["hotels.hotel_internal_rating_notes.read:all"];

describe("HotelsAdminService reads (D-171: one model per audience)", () => {
  it("answers each audience's detail in exactly its own strict model", async () => {
    const { service } = build();
    const cases = [
      [staffPrincipal(["HT"]), hotelStaffDetailFullView],
      [staffPrincipal(["FA"]), hotelStaffDetailView],
      [staffPrincipal(["HL"]), hotelStaffDetailView],
      [staffPrincipal([], CUSTOM_CONTACTS), hotelStaffDetailContactsView],
      [staffPrincipal([], CUSTOM_NOTES), hotelStaffDetailNotesView],
    ] as const;
    for (const [principal, model] of cases) {
      expect(model.safeParse(await service.getDetail(HOTEL, principal)).success).toBe(true);
    }
  });

  it("sends no restricted field to a profile reader, not even as null", async () => {
    const { service } = build();
    const hotel = await service.getDetail(HOTEL, staffPrincipal(["CD"]));
    for (const field of ["internalRating", "internalNotes", "contacts"]) {
      expect(hotel).not.toHaveProperty(field);
    }
  });

  it("lists the notes only for their readers", async () => {
    const { service } = build();
    const [sales] = (await service.list({ limit: 50 }, staffPrincipal(["SM"]))).items;
    expect(hotelStaffNotesView.safeParse(sales).success).toBe(true);
    const [finance] = (await service.list({ limit: 50 }, staffPrincipal(["FA"]))).items;
    expect(hotelStaffView.safeParse(finance).success).toBe(true);
  });
});

describe("HotelsAdminService writes the internal notes only on their own key", () => {
  const editor = staffPrincipal([], ["hotels.hotel_profiles_client_fields.update:all"]);

  it("refuses an update that names the notes without the key, before any write", async () => {
    const { service, repo } = build();
    await expect(service.update(HOTEL, { internalNotes: null }, editor)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(repo.updateHotel).not.toHaveBeenCalled();
  });

  it("applies the editor's other fields and answers in their model", async () => {
    const { service, repo } = build();
    const hotel = await service.update(HOTEL, { totalRooms: 41 }, editor);
    expect(repo.updateHotel).toHaveBeenCalledOnce();
    expect(hotelStaffDetailView.safeParse(hotel).success).toBe(true);
  });

  it("lets a create without the key carry null notes but not a value", async () => {
    const { service, repo } = build();
    const creator = staffPrincipal([], ["hotels.hotel_profiles_client_fields.create:all"]);
    const request = {
      destinationId: DESTINATION,
      name: "Second Synthetic Hotel",
      status: "draft",
      demoVisible: false,
      publicShowcase: false,
    } as const;
    await expect(service.create({ ...request, internalRating: 5 }, creator)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(repo.createHotel).not.toHaveBeenCalled();
    await service.create({ ...request, internalNotes: null }, creator);
    expect(repo.createHotel).toHaveBeenCalledOnce();
  });

  it("lets the Hotel team set them", async () => {
    const { service, repo } = build();
    await service.update(HOTEL, { internalRating: 3 }, staffPrincipal(["HT"]));
    expect(repo.updateHotel).toHaveBeenCalledOnce();
  });
});
