/*
 * Extra demo depth for Rhea's consultancy journey, split out of seed-consultancy.ts so that file stays
 * under the size cap: two more enquiries at mid-pipeline stages (so the client tracker and the staff queue
 * show a spread) and her saved-hotel shortlist with notes (so Saved, Compare and the note annotation have
 * content). Synthetic throughout (data.md); every write upserts by a fixed id (seed-consultancy-data).
 */
import { type PrismaClient } from "../src/generated/prisma/client.js";

import { HOTEL_SLUG_2, HOTEL_SLUG_3, HOTEL_SLUG_4, ID } from "./seed-consultancy-data.js";

/** Anchored at seed time, matching seed-consultancy's clock, so these dates sit alongside the main journey. */
const BASE = new Date();
function day(offset: number): Date {
  return new Date(BASE.getTime() + offset * 24 * 60 * 60 * 1000);
}

/**
 * A lightweight enquiry at a given mid-pipeline stage on another hotel — just the row, no proposal or
 * visit — so the client tracker and the staff queue show a spread of stages. Status is never reset on a
 * re-seed (so a tester's progress stands), matching upsertFreshEnquiry.
 */
async function upsertStagedEnquiry(
  prisma: PrismaClient,
  clientUserId: string,
  row: {
    readonly id: string;
    readonly slug: string;
    readonly status: "awaiting_hotel" | "negotiating";
    readonly guests: number;
    readonly rooms: number;
    readonly functions: string;
    readonly note: string;
  },
): Promise<void> {
  const hotel = await prisma.hotel.findUnique({ where: { slug: row.slug }, select: { id: true } });
  if (!hotel) return;
  await prisma.hotelEnquiry.upsert({
    where: { id: row.id },
    update: { dateFrom: day(140), dateTo: day(142), submittedAt: day(-14) },
    create: {
      id: row.id,
      accountId: ID.account,
      hotelId: hotel.id,
      requestedByUserId: clientUserId,
      status: row.status,
      dateFrom: day(140),
      dateTo: day(142),
      datesFlexible: true,
      guestEstimate: row.guests,
      roomsRequired: row.rooms,
      functionsSummary: row.functions,
      contactPreference: "WhatsApp",
      notesClient: row.note,
      submittedAt: day(-14),
      createdBy: clientUserId,
    },
  });
}

/**
 * Rhea's shortlist: a few saved hotels with notes, so the Saved screen, Compare and the note annotation
 * show content on first open (the consultancy chain creates no SavedHotel otherwise). Account-scoped.
 */
async function upsertSavedHotels(prisma: PrismaClient, clientUserId: string): Promise<void> {
  const saves: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly note: string | null;
  }> = [
    { id: ID.savedCandolim, slug: HOTEL_SLUG_3, note: "Beachside option for the welcome dinner." },
    { id: ID.savedAravalli, slug: HOTEL_SLUG_4, note: "Backup if the lakeview venue is taken." },
    { id: ID.savedRose, slug: HOTEL_SLUG_2, note: null },
  ];
  for (const save of saves) {
    const hotel = await prisma.hotel.findUnique({
      where: { slug: save.slug },
      select: { id: true },
    });
    if (!hotel) continue;
    // Key on the real (account, hotel) unique and clear any soft-delete, so a re-seed is idempotent even if
    // a tester saved or unsaved the hotel live (a plain id upsert would hit the unique or stay hidden).
    await prisma.savedHotel.upsert({
      where: { accountId_hotelId: { accountId: ID.account, hotelId: hotel.id } },
      update: { note: save.note, deletedAt: null },
      create: {
        id: save.id,
        accountId: ID.account,
        hotelId: hotel.id,
        savedByUserId: clientUserId,
        note: save.note,
        createdBy: clientUserId,
      },
    });
  }
}

/** Two more enquiries at mid-pipeline stages and Rhea's saved-hotel shortlist. Called from the main demo. */
export async function seedDemoShortlistAndStages(
  prisma: PrismaClient,
  clientUserId: string,
): Promise<void> {
  await upsertStagedEnquiry(prisma, clientUserId, {
    id: ID.enquiryAwaiting,
    slug: HOTEL_SLUG_3,
    status: "awaiting_hotel",
    guests: 220,
    rooms: 70,
    functions: "Welcome dinner, wedding and reception",
    note: "Prefer a beachfront lawn for the reception.",
  });
  await upsertStagedEnquiry(prisma, clientUserId, {
    id: ID.enquiryNegotiating,
    slug: HOTEL_SLUG_4,
    status: "negotiating",
    guests: 160,
    rooms: 50,
    functions: "Intimate hillside ceremony",
    note: "Negotiating a weekday rate for March.",
  });
  await upsertSavedHotels(prisma, clientUserId);
}
