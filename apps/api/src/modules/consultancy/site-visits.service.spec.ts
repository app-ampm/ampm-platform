import { describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@ampm/policy";

import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { AppLogger } from "../../common/logger.service.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import {
  type SiteVisitRow,
  type SiteVisitWriteData,
  SiteVisitsRepository,
} from "./site-visits.repository.js";
import { SiteVisitsService } from "./site-visits.service.js";

function makeEnquiry(over: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id: "enq-1",
    accountId: "acc-1",
    projectId: null,
    hotelId: "hot-1",
    requestedByUserId: "usr-1",
    assignedUserId: null,
    serviceAgreementId: null,
    status: "response_received",
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

function makeVisit(over: Partial<SiteVisitRow> = {}): SiteVisitRow {
  return {
    id: "sv-1",
    enquiryId: "enq-1",
    hotelId: "hot-1",
    scheduledAt: new Date("2027-02-10T09:30:00Z"),
    status: "proposed",
    attendeesText: "Bride, groom",
    outcomeInternal: null,
    clientFeedback: null,
    createdBy: "staff-ht",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function staff(roles: StaffRole[], userId = "staff-ht"): Principal {
  return {
    type: "staff",
    userId,
    name: "S",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    roles,
  };
}

const access: Access = { key: "consultancy.site_visits.create", scope: "all" };

function build(enquiry: EnquiryRow = makeEnquiry(), visit: SiteVisitRow = makeVisit()) {
  const visits = {
    create: vi.fn(async (_data: SiteVisitWriteData) => visit),
    findById: vi.fn(async () => visit),
    findByIdInScope: vi.fn(async () => visit),
    listStaff: vi.fn(async () => ({ rows: [visit], nextCursor: null })),
    update: vi.fn(async () => 1),
    updateStatus: vi.fn(async () => 1),
    updateFeedback: vi.fn(async () => undefined),
  };
  const enquiriesRepo = {
    findByIdInScope: vi.fn(async (): Promise<EnquiryRow | null> => enquiry),
  };
  const enquiries = { transition: vi.fn(async () => ({})) };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const audit = {
    record: vi.fn(
      async (_entry: { before?: Record<string, unknown>; after?: Record<string, unknown> }) =>
        undefined,
    ),
  };
  const logger = { warn: vi.fn() };
  const service = new SiteVisitsService(
    visits as unknown as SiteVisitsRepository,
    enquiriesRepo as unknown as EnquiriesRepository,
    enquiries as unknown as EnquiriesService,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    logger as unknown as AppLogger,
  );
  return { service, visits, enquiriesRepo, enquiries, audit };
}

describe("SiteVisitsService.create", () => {
  it("creates a visit with the enquiry's hotel and advances the enquiry (HT, response_received)", async () => {
    const { service, visits, enquiries } = build();
    await service.create(staff(["HT"]), access, {
      enquiryId: "enq-1",
      scheduledAt: "2027-02-10T09:30:00.000Z",
      attendeesText: "Bride, groom",
    });
    expect(visits.create).toHaveBeenCalledOnce();
    const data = visits.create.mock.calls[0]?.[0];
    expect(data?.hotelId).toBe("hot-1"); // the enquiry's hotel, not the request
    expect(enquiries.transition).toHaveBeenCalledWith(
      expect.anything(),
      access,
      "enq-1",
      expect.objectContaining({ status: "visit_scheduled" }),
    );
  });

  it("does not advance an enquiry already at visit_scheduled (best-effort no-op)", async () => {
    const { service, enquiries } = build(makeEnquiry({ status: "visit_scheduled" }));
    await service.create(staff(["HT"]), access, {
      enquiryId: "enq-1",
      scheduledAt: "2027-02-10T09:30:00.000Z",
      attendeesText: null,
    });
    expect(enquiries.transition).not.toHaveBeenCalled();
  });

  it("does not advance when the actor is not a visit_scheduled mover (SA)", async () => {
    const { service, visits, enquiries } = build();
    await service.create(staff(["SA"]), access, {
      enquiryId: "enq-1",
      scheduledAt: "2027-02-10T09:30:00.000Z",
      attendeesText: null,
    });
    expect(visits.create).toHaveBeenCalledOnce(); // the visit is still created
    expect(enquiries.transition).not.toHaveBeenCalled();
  });

  it("is 404 when the enquiry is out of the actor's scope", async () => {
    const { service, visits, enquiriesRepo } = build();
    enquiriesRepo.findByIdInScope.mockResolvedValueOnce(null);
    await expect(
      service.create(staff(["HT"]), access, {
        enquiryId: "nope",
        scheduledAt: "2027-02-10T09:30:00.000Z",
        attendeesText: null,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(visits.create).not.toHaveBeenCalled();
  });
});

describe("SiteVisitsService.transition (hand-rolled machine, CAS)", () => {
  it("allows proposed → confirmed", async () => {
    const { service, visits } = build(makeEnquiry(), makeVisit({ status: "proposed" }));
    await service.transition(staff(["HT"]), access, "sv-1", { status: "confirmed" });
    expect(visits.updateStatus).toHaveBeenCalledWith(
      "sv-1",
      "proposed",
      "confirmed",
      "staff-ht",
      expect.anything(),
    );
  });

  it("refuses an undefined move (proposed → completed) with 409", async () => {
    const { service } = build(makeEnquiry(), makeVisit({ status: "proposed" }));
    await expect(
      service.transition(staff(["HT"]), access, "sv-1", { status: "completed" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses any move on a terminal visit", async () => {
    const { service } = build(makeEnquiry(), makeVisit({ status: "completed" }));
    await expect(
      service.transition(staff(["HT"]), access, "sv-1", { status: "cancelled" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("fails cleanly (409) on a concurrent CAS miss", async () => {
    const { service, visits } = build(makeEnquiry(), makeVisit({ status: "confirmed" }));
    visits.updateStatus.mockResolvedValueOnce(0);
    await expect(
      service.transition(staff(["HT"]), access, "sv-1", { status: "completed" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("SiteVisitsService.update", () => {
  it("refuses to edit a terminal visit", async () => {
    const { service } = build(makeEnquiry(), makeVisit({ status: "cancelled" }));
    await expect(
      service.update(staff(["HT"]), access, "sv-1", { outcomeInternal: "x" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("fails cleanly (409) when a concurrent transition made the visit terminal mid-edit (CAS miss)", async () => {
    const { service, visits } = build(makeEnquiry(), makeVisit({ status: "confirmed" }));
    visits.update.mockResolvedValueOnce(0); // the row moved to terminal between read and write
    await expect(
      service.update(staff(["HT"]), access, "sv-1", { outcomeInternal: "x" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("audits the restricted outcome edit in the before/after image", async () => {
    const { service, audit } = build(
      makeEnquiry(),
      makeVisit({ status: "confirmed", outcomeInternal: null }),
    );
    await service.update(staff(["HT"]), access, "sv-1", {
      outcomeInternal: "hotel net lower; do not share",
    });
    const entry = audit.record.mock.calls[0]?.[0];
    expect(entry?.after).toMatchObject({ outcomeInternal: "hotel net lower; do not share" });
    expect(entry?.before).toMatchObject({ outcomeInternal: null });
  });
});
