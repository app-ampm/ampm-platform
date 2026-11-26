/*
 * The questions of HF-05's seven sections (plan §5.1 and §5.3; D-190 §2), with their help lines and the
 * words of their choices, in one place until the public site's i18n arrives. The checks' messages are
 * core's (the drafts' schemas); the few here are for what the page reads itself (a venue's layouts).
 */

/** The words every section's choices and rows share. */
export const COMMON_FIELDS_COPY = {
  yes: "Yes",
  no: "No",
  depends: "Depends",
  clear: "Clear",
  choose: "Choose one",
  remove: "Remove",
  removeNamed: (name: string) => `Remove ${name}`,
  removed: (name: string) => `${name} removed`,
  units: { sqft: "sq ft", sqm: "m²" },
  unitOf: (label: string) => `Unit of ${label.toLowerCase()}`,
} as const;

export const PROPERTY_FIELDS_COPY = {
  groups: {
    hotel: "The hotel",
    address: "Address",
    gettingThere: "Getting there",
    about: "About the hotel",
  },
  name: "Hotel name",
  isChain: "Is the hotel part of a chain or group?",
  groupName: "Name of the chain or group",
  street: "Street address",
  locality: "Locality or area",
  city: "City or town",
  state: "State or union territory",
  postalCode: "PIN code",
  postalCodeHelp: "6 digits",
  mapsUrl: "Google Maps link",
  mapsUrlHelp: "In Google Maps, open the hotel, choose Share and copy the link.",
  website: "Official website",
  websiteHelp: "Such as https://www.hotel.example",
  access: {
    airport: { legend: "Nearest airport", name: "Airport name" },
    railwayStation: { legend: "Nearest railway station", name: "Station name" },
    cityCentre: { legend: "City centre", name: "Name" },
  },
  km: "Distance in km",
  minutes: "Drive in minutes",
  accessNotes: "Highways, landmarks and other directions",
  starCategory: "Star category",
  description: "A short description",
  descriptionCount: (count: number, max: number) => `${count} of ${max} characters`,
  facilities: "Facilities",
  facilitiesOther: "Other facilities",
} as const;

export const CONTACT_FIELDS_COPY = {
  legend: "Contacts",
  help: "Up to 3 people. AMPM calls the first one first.",
  row: (number: number) => `Contact ${number}`,
  name: "Name",
  role: "Role",
  phone: "Phone",
  phoneHelp: "A mobile, or a landline with its area code",
  email: "Email",
  sameAsMe: "Same as me",
  add: "Add another contact",
  cap: (max: number) => `This form takes up to ${max} contacts.`,
  empty: "No contacts yet. Add the person AMPM should call first.",
} as const;

export const ROOM_FIELDS_COPY = {
  totalRooms: "Total rooms in the hotel",
  legend: "Room categories",
  help: "One row for each kind of room. Changing a row's name renames it.",
  row: (number: number) => `Room category ${number}`,
  name: "Category name",
  nameHelp: "Such as Deluxe Room or Pool Villa",
  roomCount: "Number of rooms",
  unitType: "Type",
  unitTypes: {
    room: "Room",
    suite: "Suite",
    villa: "Villa",
    cottage: "Cottage",
    tent: "Tent",
    tent_suite: "Tent suite",
    apartment: "Apartment",
    other: "Other",
  },
  size: "Size",
  maxOccupancy: "Most guests in one room",
  viewLabel: "View",
  viewHelp: "Such as lake view or garden view",
  bedConfiguration: "Beds",
  bedHelp: "Such as 1 king or 2 twin",
  notes: "Notes",
  add: "Add a room category",
  cap: (max: number) => `This form takes up to ${max} room categories.`,
  empty: "No room categories yet.",
} as const;

export const VENUE_FIELDS_COPY = {
  totalEventSpace: "Total event space",
  legend: "Venues",
  help: "One row for each space a function can use. Changing a row's name renames it.",
  row: (number: number) => `Venue ${number}`,
  name: "Venue name",
  setting: "Setting",
  settings: { indoor: "Indoor", outdoor: "Outdoor", semi_open: "Covered or semi-open" },
  venueType: "Type of venue",
  venueTypes: {
    ballroom: "Ballroom",
    lawn: "Lawn",
    poolside: "Poolside",
    rooftop: "Rooftop",
    courtyard: "Courtyard",
    beach: "Beach",
    terrace: "Terrace",
    garden: "Garden",
    amphitheatre: "Amphitheatre",
    meeting_room: "Meeting room",
    lounge: "Lounge",
    other: "Other",
  },
  area: "Area",
  seated: "Seated (dinner at round tables)",
  floating: "Floating (standing reception or cocktails)",
  capacityHelp: "A number of guests, or a range such as 250–300",
  theatre: "Theatre style",
  layouts: "Other layouts",
  layoutsHelp: "Classroom, U-shape, boardroom and so on.",
  layoutRow: (number: number) => `Layout ${number}`,
  layoutName: "Layout",
  layoutGuests: "Guests",
  layoutGuestsHelp: "A number, or a range such as 30–40",
  addLayout: "Add a layout",
  layoutsCap: (max: number) => `This form takes up to ${max} other layouts for a venue.`,
  layoutNameMissing: "Name this layout",
  layoutGuestsMissing: "Give the most guests this layout takes",
  layoutGuestsUnread: "Give a number of guests, or a range such as 30–40",
  lengthM: "Length in metres",
  widthM: "Width in metres",
  ceilingHeightM: "Ceiling height in metres",
  prefunctionArea: "Pre-function area",
  prefunctionHelp: "A foyer or lawn where guests gather before the function",
  notes: "Notes",
  add: "Add a venue",
  cap: (max: number) => `This form takes up to ${max} venues.`,
  empty: "No venues yet.",
} as const;

export const BOOKING_FIELDS_COPY = {
  buyout: "Do weddings need a full buyout of the hotel?",
  minRooms: "Fewest rooms a wedding books without a full buyout",
  minNights: "Fewest nights a wedding books",
  parallel: "Can several functions run at once, or on the same day?",
  notes: "Notes on booking terms",
} as const;

export const FOOD_FIELDS_COPY = {
  cuisines: "Cuisines your kitchens cook",
  cuisinesOther: "Other cuisines",
  facts: {
    isPureVegetarian: "Is the hotel pure vegetarian?",
    hasSeparateVegKitchen: "Is there a separate vegetarian kitchen?",
    servesAlcohol: "Is alcohol served?",
  },
} as const;

export const FACT_SHEET_FIELDS_COPY = {
  factSheetAsOf: "When was your fact sheet last updated?",
  factSheetAsOfHelp: "The month, such as 2026-09",
  uploadsSoon:
    "Uploads for your fact sheet, menus, photos and floor plans open here soon. Keep them to hand.",
} as const;
