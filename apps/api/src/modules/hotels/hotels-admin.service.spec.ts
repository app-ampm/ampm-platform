import { describe, expect, it } from "vitest";

import {
  hotelStaffDetailContactsView,
  hotelStaffDetailFullView,
  hotelStaffDetailNotesView,
  hotelStaffDetailView,
  hotelStaffNotesView,
  hotelStaffView,
} from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { StaffHotelRow } from "./hotels-admin.repository.js";
import {
  buildHotelsAdminService as build,
  DESTINATION_ID as DESTINATION,
  HOTEL_ID as HOTEL,
} from "./testing/staff-hotel-fixtures.js";

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

describe("HotelsAdminService reads the D-178 fields into every profile model", () => {
  const catalogue: Partial<StaffHotelRow> = {
    nameAliases: ["Synthetic Lake Hotel Annexe"],
    bookingNotes: "Synthetic booking note",
    weddingBuyoutPolicy: "depends",
    minNights: 2,
    airportDistanceKm: new Prisma.Decimal("24.5"),
    cuisines: ["Indian", "Other"],
  };

  it("gives Creative and Finance the INTERNAL name variants and booking terms, never the notes", async () => {
    const { service } = build(catalogue);
    for (const role of ["CD", "FA"] as const) {
      const hotel = await service.getDetail(HOTEL, staffPrincipal([role]));
      expect(hotelStaffDetailView.safeParse(hotel).success).toBe(true);
      expect(hotel).toMatchObject({
        nameAliases: ["Synthetic Lake Hotel Annexe"],
        bookingNotes: "Synthetic booking note",
        weddingBuyoutPolicy: "depends",
        minNights: 2,
        airportDistanceKm: 24.5,
        cuisines: ["Indian", "Other"],
      });
      expect(hotel).not.toHaveProperty("internalNotes");
    }
  });

  it("lists every D-178 key, empty ones as null", async () => {
    const { service } = build();
    const [item] = (await service.list({ limit: 50 }, staffPrincipal(["FA"]))).items;
    expect(hotelStaffView.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({ mapsUrl: null, nameAliases: null, servesAlcohol: null });
  });
});
