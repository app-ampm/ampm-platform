import { RAMBAGH_PALACE, UMAID_BHAWAN_PALACE } from "./seed-catalogue.rajasthan.data.js";
import type { CatalogueDestination, CatalogueHotel, Range } from "./seed-catalogue.types.js";
import { LEELA_PALACE_UDAIPUR, OBEROI_UDAIVILAS } from "./seed-catalogue.udaipur.data.js";

/*
 * Starter catalogue (D-159): the destinations and the five real wedding hotels the catalogue load creates,
 * with ROUGH public-source details the Hotel team corrects later. Between them the hotels fill every
 * catalogue field and use every venue type and rate-item type. Data only; the load logic is in
 * seed-catalogue.ts.
 */

export const CATALOGUE_DESTINATIONS: readonly CatalogueDestination[] = [
  {
    slug: "udaipur",
    name: "Udaipur",
    region: "Mewar",
    state: "Rajasthan",
    description:
      "The City of Lakes: palace hotels on Lake Pichola for lakeside pheras and boat arrivals. " +
      "Best from October to March.",
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    region: "Dhundhar",
    state: "Rajasthan",
    description:
      "The Pink City: fort and palace hotels with large lawns for big baraats and receptions. " +
      "Best from October to March.",
  },
  {
    slug: "jodhpur",
    name: "Jodhpur",
    region: "Marwar",
    state: "Rajasthan",
    description:
      "The Blue City below Mehrangarh Fort: exclusive palace weddings with desert evenings. " +
      "Best from October to March.",
  },
  {
    slug: "goa",
    name: "Goa",
    region: "Konkan coast",
    state: "Goa",
    description:
      "Beach weddings on the Arabian Sea: sunset pheras on the sand and poolside parties. " +
      "Best from November to February.",
  },
];

const TAJ_EXOTICA_GOA: CatalogueHotel = {
  slug: "taj-exotica-goa",
  name: "Taj Exotica Resort & Spa, Goa",
  destination: "goa",
  brand: "Taj Hotels (IHCL)",
  starCategory: "5",
  totalRooms: 140,
  address: "Calwaddo, Benaulim, Salcete, South Goa, Goa 403716",
  latitude: "15.239900",
  longitude: "73.928200",
  website: "https://www.tajhotels.com/",
  descriptionClient:
    "A Mediterranean-style beach resort in landscaped gardens on Benaulim beach, with a beach lawn for " +
    "sunset pheras, a pool deck and an indoor hall for the monsoon months.",
  facilities: [
    "Private beach",
    "Beach lawn",
    "Spa",
    "Swimming pool",
    "Kids' club",
    "Watersports",
    "Valet parking",
  ],
  internalRating: 4,
  rooms: [
    {
      name: "Luxury Garden-View Room",
      roomCount: 80,
      maxOccupancy: 3,
      sizeSqm: 40,
      facilities: ["Garden view", "Balcony", "Tea and coffee"],
      description: "Rooms facing the gardens, for the wedding party.",
      rate: [22000, 32000],
      nextRate: [24000, 35000],
    },
    {
      name: "Luxury Sea-View Room",
      roomCount: 45,
      maxOccupancy: 3,
      sizeSqm: 40,
      facilities: ["Sea view", "Balcony", "Tea and coffee"],
      description: "Rooms looking out to the Arabian Sea, for close family.",
      rate: [28000, 40000],
      nextRate: [30000, 43000],
    },
    {
      name: "Villa with Private Pool",
      roomCount: 15,
      maxOccupancy: 4,
      sizeSqm: 150,
      facilities: ["Private pool", "Living room", "Butler service"],
      description: "Standalone villas with their own pool, for the couple and the parents.",
      rate: [60000, 100000],
      nextRate: [65000, 108000],
    },
  ],
  venues: [
    {
      name: "Beach Lawn",
      venueType: "beach",
      isIndoor: false,
      areaSqm: 2500,
      capacityBanquet: 400,
      capacityReception: 800,
      capacityTheatre: 500,
      facilities: ["Sea-facing stage", "Sand setup", "Power backup"],
      description: "A lawn running onto the sand, for sunset pheras and the reception.",
      rental: [500000, 1000000],
    },
    {
      name: "Pool Deck",
      venueType: "poolside",
      isIndoor: false,
      areaSqm: 700,
      capacityBanquet: 150,
      capacityReception: 250,
      capacityTheatre: 180,
      facilities: ["Poolside bar", "Ambient lighting"],
      description: "A pool deck for the haldi, brunches and a pool party.",
      rental: [250000, 500000],
    },
    {
      name: "Banquet Hall",
      venueType: "ballroom",
      isIndoor: true,
      areaSqm: 650,
      capacityBanquet: 250,
      capacityReception: 400,
      capacityTheatre: 300,
      facilities: ["Air conditioning", "AV system", "Stage"],
      description: "An indoor hall for dinners and the monsoon months.",
      rental: [300000, 600000],
    },
    {
      name: "Mandap Pavilion",
      venueType: "other",
      isIndoor: false,
      areaSqm: 300,
      capacityBanquet: 80,
      capacityReception: 120,
      capacityTheatre: 100,
      facilities: ["Covered mandap", "Garden setting"],
      description: "A covered garden pavilion for pheras out of the midday sun or rain.",
      rental: [150000, 300000],
    },
  ],
  rates: {
    vegPlate: [3500, 5000],
    nonVegPlate: [4000, 5500],
    minCovers: 100,
    weddingPackage: [3500000, 7000000],
    beveragePackage: [2500, 4000],
    serviceChargePercent: 10,
    lateNightMusic: [150000, 300000],
    nextWeddingPackage: [3800000, 7500000],
  },
};

export const CATALOGUE_HOTELS: readonly CatalogueHotel[] = [
  OBEROI_UDAIVILAS,
  LEELA_PALACE_UDAIPUR,
  RAMBAGH_PALACE,
  UMAID_BHAWAN_PALACE,
  TAJ_EXOTICA_GOA,
];

/** GST on hotel rooms and banqueting, as a percentage range (12% to 18%, by item and room tariff). */
export const CATALOGUE_GST_PERCENT: Range = [12, 18];
