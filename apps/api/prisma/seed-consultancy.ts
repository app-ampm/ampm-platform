/*
 * A populated hotel-consultancy journey for the client demo (Flow-2, features 10.1-10.5). Rhea
 * (local:client) gets a client account, an active Hotel Discovery subscription (so she reaches the
 * catalogue — project_hotels reach is still empty, hotels.repository) and one enquiry on The Lake
 * Pavilion carried to the client-decision step: a sent agreement to accept, a completed site visit to
 * give feedback on, a shared proposal to decide, and its booking milestones. Internal-only events, a
 * non-client-visible proposal line and the internal total are seeded too, so the client views are proven
 * to strip them (security.md). Synthetic throughout (data.md); every write upserts by a fixed id (in
 * seed-consultancy-data), so re-seeding never duplicates. Called from the main seed with Rhea's user id.
 */
import { Prisma, type PrismaClient } from "../src/generated/prisma/client.js";

import {
  EVENTS,
  HOTEL_SLUG,
  HOTEL_SLUG_2,
  ID,
  LINES,
  MILESTONES,
} from "./seed-consultancy-data.js";
import { seedDemoShortlistAndStages } from "./seed-consultancy-extra.js";

/**
 * Anchored at seed time (not a fixed date): the journey so far — submitted through proposal shared —
 * sits in the recent past and the pending milestones and the wedding stay in the future, so the demo
 * reads correctly whenever the box is (re)seeded and the overdue sweep does not flip the pending
 * milestones for weeks. Re-seeding just refreshes these dates; the fixed row ids keep it idempotent.
 */
const BASE = new Date();
function day(offset: number): Date {
  return new Date(BASE.getTime() + offset * 24 * 60 * 60 * 1000);
}
function money(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

interface DemoRefs {
  readonly hotelId: string;
  readonly planId: string;
  readonly serviceTypeId: string;
}

/** The rows the chain hangs off, resolved by their stable business keys (slug / planKey / serviceKey). */
async function resolveRefs(prisma: PrismaClient): Promise<DemoRefs | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { slug: HOTEL_SLUG },
    select: { id: true },
  });
  const plan = await prisma.plan.findUnique({
    where: { planKey: "discovery" },
    select: { id: true },
  });
  const serviceType = await prisma.serviceType.findUnique({
    where: { serviceKey: "negotiation" },
    select: { id: true },
  });
  if (!hotel || !plan || !serviceType) return null;
  return { hotelId: hotel.id, planId: plan.id, serviceTypeId: serviceType.id };
}

/** Rhea's client account and her contact row (what accountIdForUser resolves her enquiries by). */
async function upsertAccount(prisma: PrismaClient, clientUserId: string): Promise<void> {
  await prisma.clientAccount.upsert({
    where: { id: ID.account },
    update: { primaryContactUserId: clientUserId, status: "active" },
    create: {
      id: ID.account,
      name: "Rhea & Partner",
      coupleNames: "Rhea & Aarav",
      status: "active",
      primaryContactUserId: clientUserId,
      createdBy: clientUserId,
    },
  });
  await prisma.accountContact.upsert({
    where: { id: ID.contact },
    update: { userId: clientUserId },
    create: {
      id: ID.contact,
      accountId: ID.account,
      name: "Rhea Client",
      relation: "self",
      email: "client@example.com",
      isDecisionMaker: true,
      userId: clientUserId,
      createdBy: clientUserId,
    },
  });
}

/** An active Hotel Discovery subscription, so Rhea reaches the whole catalogue (all_hotels). */
async function upsertSubscription(prisma: PrismaClient, planId: string): Promise<void> {
  await prisma.subscription.upsert({
    where: { id: ID.subscription },
    update: { status: "active", startsAt: day(-10), endsAt: day(20) },
    create: {
      id: ID.subscription,
      accountId: ID.account,
      planId,
      status: "active",
      startsAt: day(-10),
      endsAt: day(20),
    },
  });
}

/** The enquiry at the client-decision step: a proposal is shared and awaits Rhea's call. */
async function upsertEnquiry(
  prisma: PrismaClient,
  refs: DemoRefs,
  clientUserId: string,
): Promise<void> {
  await prisma.hotelEnquiry.upsert({
    where: { id: ID.enquiry },
    // Refresh the dates (re-anchoring them on a re-seed) and the agreement link, but NOT `status`: never
    // resurrect a closed demo enquiry — that would collide with any replacement open enquiry on the
    // (account, hotel) partial unique index. A clean wipe+reseed still creates it at "client_decision".
    update: {
      serviceAgreementId: ID.agreement,
      dateFrom: day(100),
      dateTo: day(102),
      submittedAt: day(-21),
    },
    create: {
      id: ID.enquiry,
      accountId: ID.account,
      hotelId: refs.hotelId,
      requestedByUserId: clientUserId,
      serviceAgreementId: ID.agreement,
      status: "client_decision",
      dateFrom: day(100),
      dateTo: day(102),
      datesFlexible: false,
      guestEstimate: 180,
      roomsRequired: 60,
      functionsSummary: "Sangeet, wedding ceremony and reception",
      contactPreference: "WhatsApp",
      notesClient: "Looking for a lakeview venue with in-house catering.",
      notesInternal: "Internal: target 8% off rack rate; GM is flexible on February dates.",
      submittedAt: day(-21),
      createdBy: clientUserId,
    },
  });
}

async function upsertEvents(prisma: PrismaClient, clientUserId: string): Promise<void> {
  for (const event of EVENTS) {
    await prisma.hotelEnquiryEvent.upsert({
      where: { id: event.id },
      update: {
        occurredAt: day(event.offset),
        summary: event.summary,
        internalOnly: event.internalOnly,
      },
      create: {
        id: event.id,
        enquiryId: ID.enquiry,
        eventType: event.type,
        occurredAt: day(event.offset),
        userId: clientUserId,
        summary: event.summary,
        internalOnly: event.internalOnly,
        createdBy: clientUserId,
      },
    });
  }
}

/** A sent hotel-assistance agreement Rhea can accept from the portal (status "sent"). */
async function upsertAgreement(
  prisma: PrismaClient,
  serviceTypeId: string,
  clientUserId: string,
): Promise<void> {
  await prisma.serviceAgreement.upsert({
    where: { id: ID.agreement },
    update: { status: "sent", hotelEnquiryId: ID.enquiry },
    create: {
      id: ID.agreement,
      accountId: ID.account,
      serviceTypeId,
      hotelEnquiryId: ID.enquiry,
      scopeText: "Rate negotiation and booking coordination with The Lake Pavilion.",
      feeAmount: money("25000.00"),
      feeStructure: "fixed",
      currency: "INR",
      termsVersion: "2026-11",
      status: "sent",
      createdBy: clientUserId,
    },
  });
}

/** A completed site visit with no client feedback yet, so Rhea's feedback write is exercised. */
async function upsertVisit(
  prisma: PrismaClient,
  refs: DemoRefs,
  clientUserId: string,
): Promise<void> {
  await prisma.siteVisit.upsert({
    where: { id: ID.visit },
    update: { status: "completed", scheduledAt: day(-10) },
    create: {
      id: ID.visit,
      enquiryId: ID.enquiry,
      hotelId: refs.hotelId,
      scheduledAt: day(-10),
      status: "completed",
      attendeesText: "AMPM coordinator and the venue manager",
      outcomeInternal: "Lawn capacity confirmed for 180; a lakeview suite is available.",
      createdBy: clientUserId,
    },
  });
}

/** A shared proposal (immutable once shared, data.md): client total ₹18,50,000, internal ₹17,00,000. */
async function upsertProposal(
  prisma: PrismaClient,
  refs: DemoRefs,
  clientUserId: string,
): Promise<void> {
  await prisma.hotelProposal.upsert({
    where: { id: ID.proposal },
    update: { status: "shared", sharedAt: day(-7), validUntil: day(14) },
    create: {
      id: ID.proposal,
      enquiryId: ID.enquiry,
      hotelId: refs.hotelId,
      versionNumber: 1,
      status: "shared",
      validUntil: day(14),
      clientTotalAmount: money("1850000.00"),
      internalTotalAmount: money("1700000.00"),
      currency: "INR",
      sharedAt: day(-7),
      createdBy: clientUserId,
    },
  });
}

async function upsertProposalLines(prisma: PrismaClient, clientUserId: string): Promise<void> {
  for (const line of LINES) {
    await prisma.hotelProposalLine.upsert({
      where: { id: line.id },
      update: { clientVisible: line.clientVisible },
      create: {
        id: line.id,
        proposalId: ID.proposal,
        itemType: line.itemType,
        description: line.description,
        quantity: money(line.quantity),
        unitAmount: money(line.unitAmount),
        totalAmount: money(line.totalAmount),
        clientVisible: line.clientVisible,
        createdBy: clientUserId,
      },
    });
  }
}

async function upsertMilestones(prisma: PrismaClient, clientUserId: string): Promise<void> {
  for (const milestone of MILESTONES) {
    await prisma.bookingMilestone.upsert({
      where: { id: milestone.id },
      update: {
        status: milestone.status,
        dueAt: day(milestone.due),
        completedAt: milestone.completed === null ? null : day(milestone.completed),
        documentId: milestone.documentId,
      },
      create: {
        id: milestone.id,
        enquiryId: ID.enquiry,
        milestoneType: milestone.type,
        status: milestone.status,
        dueAt: day(milestone.due),
        completedAt: milestone.completed === null ? null : day(milestone.completed),
        amount: milestone.amount === null ? null : money(milestone.amount),
        currency: milestone.amount === null ? null : "INR",
        documentId: milestone.documentId,
        createdBy: clientUserId,
      },
    });
  }
}

/** A second enquiry left at `submitted` on another hotel, so a staff member can drive the whole pipeline
 *  from the start (SA can only do the client-decision tail; the Hotel team drives the earlier stages). */
async function upsertFreshEnquiry(prisma: PrismaClient, clientUserId: string): Promise<void> {
  const hotel = await prisma.hotel.findUnique({
    where: { slug: HOTEL_SLUG_2 },
    select: { id: true },
  });
  if (!hotel) return;
  await prisma.hotelEnquiry.upsert({
    where: { id: ID.pipelineEnquiry },
    // Refresh the dates only; never reset `status`, so a re-seed does not rewind an enquiry a tester has
    // already driven forward (nor collide on the (account, hotel) open-unique index).
    update: { dateFrom: day(130), dateTo: day(132), submittedAt: day(-2) },
    create: {
      id: ID.pipelineEnquiry,
      accountId: ID.account,
      hotelId: hotel.id,
      requestedByUserId: clientUserId,
      status: "submitted",
      dateFrom: day(130),
      dateTo: day(132),
      datesFlexible: true,
      guestEstimate: 120,
      roomsRequired: 40,
      functionsSummary: "Mehndi and wedding ceremony",
      contactPreference: "WhatsApp",
      notesClient: "Exploring a second venue in Jaipur as a backup.",
      submittedAt: day(-2),
      createdBy: clientUserId,
    },
  });
}

/** Seed Rhea's whole consultancy journey. Needs the plan, the negotiation service type and the hotel. */
export async function seedConsultancyDemo(
  prisma: PrismaClient,
  clientUserId: string,
): Promise<void> {
  const refs = await resolveRefs(prisma);
  if (!refs) {
    throw new Error(
      "consultancy demo needs the discovery plan, the negotiation service type and the Lake Pavilion hotel",
    );
  }
  await upsertAccount(prisma, clientUserId);
  await upsertSubscription(prisma, refs.planId);
  await upsertEnquiry(prisma, refs, clientUserId);
  await upsertEvents(prisma, clientUserId);
  await upsertAgreement(prisma, refs.serviceTypeId, clientUserId);
  await upsertVisit(prisma, refs, clientUserId);
  await upsertProposal(prisma, refs, clientUserId);
  await upsertProposalLines(prisma, clientUserId);
  await upsertMilestones(prisma, clientUserId);
  await upsertFreshEnquiry(prisma, clientUserId);
  await seedDemoShortlistAndStages(prisma, clientUserId);
}
