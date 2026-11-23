import { describe, expect, it } from "vitest";

import {
  hotelStaffDetail,
  hotelStaffDetailContactsView,
  hotelStaffDetailFullView,
  hotelStaffDetailNotesView,
  hotelStaffDetailView,
  hotelStaffListItem,
  hotelStaffNotesView,
  hotelStaffView,
} from "./hotel-staff-views.js";

const HOTEL = "0192f1a0-0000-7000-8000-000000000001";
const DESTINATION = "0192f1a0-0000-7000-8000-000000000002";

/** A synthetic hotel profile, as every reader of the client-fields row gets it. */
const profile = {
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
  totalRooms: 40,
  streetViewRef: null,
  lastVerifiedAt: null,
  facilities: null,
  parentGroup: null,
  nameAliases: null,
  locality: null,
  city: "Udaipur",
  state: "Rajasthan",
  postalCode: null,
  mapsUrl: null,
  airportName: null,
  airportDistanceKm: 22.5,
  airportDriveMinutes: 35,
  railwayStationName: null,
  railwayDistanceKm: null,
  railwayDriveMinutes: null,
  cityCentreDistanceKm: null,
  cityCentreDriveMinutes: null,
  accessNotes: null,
  totalEventSpaceSqm: null,
  totalEventSpaceSqft: null,
  weddingBuyoutPolicy: "depends",
  minRoomsWithoutBuyout: 40,
  minNights: 2,
  parallelFunctions: null,
  bookingNotes: "Synthetic booking note",
  cuisines: ["Indian"],
  isPureVegetarian: null,
  hasSeparateVegKitchen: null,
  servesAlcohol: true,
};
const notes = { internalRating: 4, internalNotes: "Synthetic note" };
const contacts = {
  contacts: [
    {
      id: "0192f1a0-0000-7000-8000-000000000003",
      hotelId: HOTEL,
      name: "Test Contact",
      roleTitle: null,
      phone: null,
      email: "contact@example.com",
      isPrimary: true,
    },
  ],
};
const detail = {
  ...profile,
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
};

describe("the staff hotel list item (D-171)", () => {
  it("keeps the internal rating and notes out of the profile model", () => {
    expect(hotelStaffView.safeParse(profile).success).toBe(true);
    expect(hotelStaffView.safeParse({ ...profile, ...notes }).success).toBe(false);
  });

  it("has a model with the internal rating and notes for their readers", () => {
    expect(hotelStaffNotesView.safeParse({ ...profile, ...notes }).success).toBe(true);
    expect(hotelStaffNotesView.safeParse(profile).success).toBe(false);
  });

  it("accepts either audience's item, and never contacts in the list", () => {
    expect(hotelStaffListItem.safeParse(profile).success).toBe(true);
    expect(hotelStaffListItem.safeParse({ ...profile, ...notes }).success).toBe(true);
    expect(hotelStaffListItem.safeParse({ ...profile, ...contacts }).success).toBe(false);
  });

  it("is absent, not null: half the notes group fits no model", () => {
    expect(hotelStaffListItem.safeParse({ ...profile, internalRating: null }).success).toBe(false);
  });
});

describe("the staff hotel detail (D-171)", () => {
  it("matches each audience to exactly one strict model", () => {
    const cases = [
      [detail, hotelStaffDetailView],
      [{ ...detail, ...notes }, hotelStaffDetailNotesView],
      [{ ...detail, ...contacts }, hotelStaffDetailContactsView],
      [{ ...detail, ...notes, ...contacts }, hotelStaffDetailFullView],
    ] as const;
    const models = cases.map(([, model]) => model);
    for (const [payload, model] of cases) {
      expect(models.filter((candidate) => candidate.safeParse(payload).success)).toEqual([model]);
      expect(hotelStaffDetail.safeParse(payload).success).toBe(true);
    }
  });

  it("keeps the contacts and the notes out of the profile reader's model", () => {
    expect(hotelStaffDetailView.safeParse({ ...detail, ...contacts }).success).toBe(false);
    expect(hotelStaffDetailView.safeParse({ ...detail, ...notes }).success).toBe(false);
  });

  it("refuses an unknown field whatever the audience", () => {
    expect(hotelStaffDetail.safeParse({ ...detail, contactsHidden: true }).success).toBe(false);
  });
});
