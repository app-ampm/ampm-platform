import type { Entitlements } from "@ampm/policy";
import { describe, expect, it, vi } from "vitest";

import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { EventBus } from "../../jobs/event-bus.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelsService } from "../hotels/hotels.service.js";
import { EnquiriesClientService } from "./enquiries-client.service.js";
import { EnquiryEventsRepository } from "./enquiry-events.repository.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";

function makeRow(over: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id: "enq-1",
    accountId: "acc-1",
    projectId: null,
    hotelId: "hot-1",
    requestedByUserId: "usr-1",
    assignedUserId: null,
    serviceAgreementId: null,
    status: "submitted",
    dateFrom: new Date("2027-02-14"),
    dateTo: new Date("2027-02-16"),
    datesFlexible: false,
    guestEstimate: 120,
    roomsRequired: 40,
    functionsSummary: null,
    contactPreference: null,
    notesClient: null,
    notesInternal: null,
    submittedAt: new Date(),
    closedAt: null,
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function entitlements(over: Partial<Entitlements> = {}): Entitlements {
  return {
    modules: ["hotel_assistance"],
    readOnlyModules: [],
    hotelReach: ["all_hotels"],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
    ...over,
  };
}

function client(type: "client" | "demo", ent: Entitlements): Principal {
  return {
    type,
    userId: "usr-1",
    name: "T",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    entitlements: ent,
  };
}

const staff: Principal = {
  type: "staff",
  userId: "staff-1",
  name: "S",
  email: null,
  phone: null,
  status: "active",
  lastLoginAt: null,
  memberships: [],
  roles: ["HT"],
};

const request = {
  hotelId: "hot-1",
  dateFrom: "2027-02-14",
  dateTo: "2027-02-16",
  datesFlexible: false,
  guestEstimate: 120,
  roomsRequired: 40,
  functionsSummary: null,
  contactPreference: null,
  notesClient: null,
};

function build(overrides: Partial<Record<string, unknown>> = {}) {
  const enquiries = {
    accountIdForUser: vi.fn(async () => "acc-1"),
    findOpenForAccountHotel: vi.fn(async () => null as EnquiryRow | null),
    create: vi.fn(async () => makeRow()),
    findByIdForAccount: vi.fn(async () => makeRow()),
    updateNotesClient: vi.fn(async () => undefined),
    listForAccount: vi.fn(async () => ({ rows: [], nextCursor: null })),
    ...overrides,
  };
  const events = {
    create: vi.fn(async () => undefined),
    listByEnquiry: vi.fn(async () => []),
  };
  const hotels = { requireHotelInReach: vi.fn(async () => undefined) };
  const bus = { emit: vi.fn(async () => undefined) };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const logger = { warn: vi.fn() };
  const service = new EnquiriesClientService(
    enquiries as unknown as EnquiriesRepository,
    events as unknown as EnquiryEventsRepository,
    hotels as unknown as HotelsService,
    bus as unknown as EventBus,
    prisma as unknown as PrismaService,
    logger as unknown as AppLogger,
  );
  return { service, enquiries, hotels, bus };
}

describe("EnquiriesClientService.requestAssistance", () => {
  it("is absence (404) for a staff principal — clients/demo only", async () => {
    await expect(build().service.requestAssistance(staff, request)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("is absence (404) for a client without the hotel_assistance module (trial/none)", async () => {
    const principal = client("client", entitlements({ modules: [] }));
    await expect(build().service.requestAssistance(principal, request)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("is absence (404) for a read-only hotel_assistance (lapsed) on a create", async () => {
    const principal = client("client", entitlements({ readOnlyModules: ["hotel_assistance"] }));
    await expect(build().service.requestAssistance(principal, request)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("routes a demo prospect to Sales and creates no enquiry (P-7, AC-03.4)", async () => {
    const { service, enquiries, bus } = build();
    const result = await service.requestAssistance(client("demo", entitlements()), request);
    expect(result).toEqual({ kind: "routed_to_sales" });
    expect(bus.emit).toHaveBeenCalledTimes(1);
    expect(enquiries.create).not.toHaveBeenCalled();
  });

  it("creates an enquiry for a subscriber and checks the hotel is in reach", async () => {
    const { service, enquiries, hotels } = build();
    const result = await service.requestAssistance(client("client", entitlements()), request);
    expect(result.kind).toBe("enquiry");
    expect(hotels.requireHotelInReach).toHaveBeenCalledOnce();
    expect(enquiries.create).toHaveBeenCalledOnce();
  });

  it("is idempotent: an existing open enquiry for the hotel is returned, not duplicated (AC-26)", async () => {
    const existing = makeRow({ id: "enq-existing" });
    const { service, enquiries } = build({
      findOpenForAccountHotel: vi.fn(async () => existing),
    });
    const result = await service.requestAssistance(client("client", entitlements()), request);
    expect(result).toEqual({
      kind: "enquiry",
      enquiry: expect.objectContaining({ id: "enq-existing" }),
    });
    expect(enquiries.create).not.toHaveBeenCalled();
  });

  it("never serialises an internal field onto the client view", async () => {
    const { service } = build();
    const result = await service.requestAssistance(client("client", entitlements()), request);
    if (result.kind !== "enquiry") throw new Error("expected an enquiry");
    expect(result.enquiry).not.toHaveProperty("notesInternal");
    expect(result.enquiry).not.toHaveProperty("accountId");
    expect(result.enquiry).not.toHaveProperty("assignedUserId");
    expect(result.enquiry).not.toHaveProperty("serviceAgreementId");
    expect(result.enquiry).not.toHaveProperty("requestedByUserId");
  });
});
