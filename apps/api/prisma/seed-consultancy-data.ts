/*
 * The synthetic rows for the hotel-consultancy demo (seed-consultancy.ts): the fixed ids and the event,
 * proposal-line and milestone data, kept apart so the seed logic stays under the file-size cap (as
 * seed-hotels is split from seed). `offset` is days relative to the seed-time anchor the logic applies.
 * Synthetic throughout (data.md); the fixed ids keep every upsert idempotent on a re-seed.
 */

/** Fixed ids (the `d` block; the portal demo uses `c`) so every row upserts in place on a re-seed. */
export const ID = {
  account: "0192f3a0-7d3e-7b1a-9c2f-0000000000d1",
  contact: "0192f3a0-7d3e-7b1a-9c2f-0000000000d2",
  subscription: "0192f3a0-7d3e-7b1a-9c2f-0000000000d3",
  enquiry: "0192f3a0-7d3e-7b1a-9c2f-0000000000d4",
  agreement: "0192f3a0-7d3e-7b1a-9c2f-0000000000d5",
  visit: "0192f3a0-7d3e-7b1a-9c2f-0000000000d6",
  proposal: "0192f3a0-7d3e-7b1a-9c2f-0000000000d7",
} as const;

export const HOTEL_SLUG = "lake-pavilion-udaipur";

/** The enquiry timeline, including one internal_only event the client serialiser must drop. */
export const EVENTS = [
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e1",
    type: "submitted",
    offset: -21,
    summary: null,
    internalOnly: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e2",
    type: "sent_to_hotel",
    offset: -20,
    summary: "Shared your requirements with The Lake Pavilion.",
    internalOnly: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e3",
    type: "hotel_response",
    offset: -18,
    summary: "The hotel confirmed availability for your dates.",
    internalOnly: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e4",
    type: "negotiation_note",
    offset: -16,
    summary: "Internal: held the rack rate down by 8%.",
    internalOnly: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e5",
    type: "visit",
    offset: -10,
    summary: "Site visit completed at The Lake Pavilion.",
    internalOnly: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e6",
    type: "proposal",
    offset: -7,
    summary: "A proposal is ready for your review.",
    internalOnly: false,
  },
] as const;

/** The proposal lines: three client-visible (summing to the client total) and one internal-only. */
export const LINES = [
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d8",
    itemType: "room_rate",
    description: "60 deluxe lakeview rooms × 2 nights",
    quantity: "120.00",
    unitAmount: "12000.00",
    totalAmount: "1440000.00",
    clientVisible: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d9",
    itemType: "wedding_package",
    description: "Sangeet and reception package (180 guests)",
    quantity: "1.00",
    unitAmount: "350000.00",
    totalAmount: "350000.00",
    clientVisible: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000da",
    itemType: "service_charge",
    description: "Coordination and on-site service",
    quantity: "1.00",
    unitAmount: "60000.00",
    totalAmount: "60000.00",
    clientVisible: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000db",
    itemType: "other",
    description: "Hotel net rate (internal basis)",
    quantity: "1.00",
    unitAmount: "1700000.00",
    totalAmount: "1700000.00",
    clientVisible: false,
  },
] as const;

/** The booking milestones: the hold is done, the rest pending; one carries a (W-14-hidden) amount. */
export const MILESTONES = [
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000dc",
    type: "hold_placed",
    status: "done",
    due: -6,
    completed: -6,
    amount: null,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000dd",
    type: "contract_sent",
    status: "pending",
    due: 4,
    completed: null,
    amount: null,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000de",
    type: "advance_paid",
    status: "pending",
    due: 11,
    completed: null,
    amount: "500000.00",
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000df",
    type: "confirmed",
    status: "pending",
    due: 21,
    completed: null,
    amount: null,
  },
] as const;
