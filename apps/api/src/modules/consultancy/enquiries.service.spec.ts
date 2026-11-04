import { describe, expect, it, vi } from "vitest";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import type { StaffRole } from "@ampm/policy";
import { NotificationService } from "../admin/notification/notification.service.js";
import { EnquiryEventsRepository, type EnquiryEventRow } from "./enquiry-events.repository.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";

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
    notesInternal: "internal only",
    submittedAt: new Date(),
    closedAt: null,
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function makeEvent(over: Partial<EnquiryEventRow> = {}): EnquiryEventRow {
  return {
    id: "evt-1",
    enquiryId: "enq-1",
    eventType: "hotel_response",
    occurredAt: new Date(),
    userId: "staff-1",
    summary: null,
    internalOnly: false,
    documentId: null,
    createdAt: new Date(),
    ...over,
  };
}

function staff(roles: StaffRole[], userId = "staff-1"): Principal {
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

const access: Access = { key: "consultancy.enquiries.read", scope: "all" };

function build(row: EnquiryRow = makeRow(), events: EnquiryEventRow[] = []) {
  const repo = {
    findById: vi.fn(async () => row),
    findByIdInScope: vi.fn(async () => row),
    listStaff: vi.fn(async () => ({ rows: [row], nextCursor: null })),
    updateStatus: vi.fn(async () => undefined),
    updateStaffFields: vi.fn(async () => undefined),
    accountClientUserIds: vi.fn(async () => ["client-user-1"]),
  };
  const eventsRepo = {
    create: vi.fn(async () => makeEvent()),
    listByEnquiry: vi.fn(async () => events),
  };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const audit = { record: vi.fn(async () => undefined) };
  const notifications = { queue: vi.fn(async () => ({ suppressed: false, notificationId: "n1" })) };
  const logger = { warn: vi.fn() };
  const service = new EnquiriesService(
    repo as unknown as EnquiriesRepository,
    eventsRepo as unknown as EnquiryEventsRepository,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    notifications as unknown as NotificationService,
    logger as unknown as AppLogger,
  );
  return { service, repo, eventsRepo, audit, notifications };
}

describe("EnquiriesService.transition", () => {
  it("409s a transition off a terminal enquiry", async () => {
    const { service, repo } = build(makeRow({ status: "closed" }));
    await expect(
      service.transition(staff(["HT"]), access, "enq-1", {
        status: "submitted",
        outcome: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("409s an undefined transition (submitted -> visit_scheduled)", async () => {
    const { service, repo } = build(makeRow({ status: "submitted" }));
    await expect(
      service.transition(staff(["HT"]), access, "enq-1", {
        status: "visit_scheduled",
        outcome: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("403s a defined transition the principal may not make (CD on an HT-only step)", async () => {
    const { service, repo } = build(makeRow({ status: "submitted" }));
    await expect(
      service.transition(staff(["CD"]), access, "enq-1", {
        status: "awaiting_hotel",
        outcome: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("moves submitted -> awaiting_hotel for HT, writing an internal-only event and no client notice", async () => {
    const { service, repo, eventsRepo, audit, notifications } = build(
      makeRow({ status: "submitted" }),
    );
    await service.transition(staff(["HT"]), access, "enq-1", {
      status: "awaiting_hotel",
      outcome: null,
      summary: null,
    });
    expect(repo.updateStatus).toHaveBeenCalledOnce();
    expect(eventsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "status_change", internalOnly: true }),
      "staff-1",
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledOnce();
    expect(notifications.queue).not.toHaveBeenCalled(); // awaiting_hotel is internal
  });

  it("requires an outcome to close", async () => {
    const { service, repo } = build(makeRow({ status: "submitted" }));
    await expect(
      service.transition(staff(["SA"]), access, "enq-1", {
        status: "closed",
        outcome: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it("closes with an outcome and notifies the client (AC-05.3)", async () => {
    const { service, repo, notifications } = build(makeRow({ status: "submitted" }));
    await service.transition(staff(["SA"]), access, "enq-1", {
      status: "closed",
      outcome: "declined",
      summary: null,
    });
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "enq-1",
      expect.objectContaining({ status: "closed", outcome: "declined" }),
      "staff-1",
      expect.anything(),
    );
    expect(notifications.queue).toHaveBeenCalledTimes(1); // one client user, closed is client-visible
  });

  it("blocks confirmed until the 10.5 milestone + contract mechanism exists (AC-05.6)", async () => {
    const { service, repo } = build(makeRow({ status: "client_decision" }));
    await expect(
      service.transition(staff(["HT"]), access, "enq-1", {
        status: "confirmed",
        outcome: null,
        summary: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});

describe("EnquiriesService.addEvent", () => {
  it("rejects a system-managed event type", async () => {
    const { service, eventsRepo } = build();
    await expect(
      service.addEvent(staff(["HT"]), access, "enq-1", {
        eventType: "status_change",
        summary: null,
        internalOnly: false,
        documentId: null,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(eventsRepo.create).not.toHaveBeenCalled();
  });

  it("appends a staff event", async () => {
    const { service, eventsRepo, audit } = build();
    await service.addEvent(staff(["HT"]), access, "enq-1", {
      eventType: "hotel_response",
      summary: "Called the hotel",
      internalOnly: false,
      documentId: null,
    });
    expect(eventsRepo.create).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledOnce();
  });

  it("forces an internal-natured event type to internalOnly even when the caller sent false (fail closed)", async () => {
    const { service, eventsRepo } = build();
    await service.addEvent(staff(["HT"]), access, "enq-1", {
      eventType: "hotel_response",
      summary: "hotel net rate is X",
      internalOnly: false,
      documentId: null,
    });
    expect(eventsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "hotel_response", internalOnly: true }),
      "staff-1",
      expect.anything(),
    );
  });

  it("rejects a documentId until the documents service lands (feature 10.2)", async () => {
    const { service, eventsRepo } = build();
    await expect(
      service.addEvent(staff(["HT"]), access, "enq-1", {
        eventType: "hotel_response",
        summary: null,
        internalOnly: false,
        documentId: "00000000-0000-7000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(eventsRepo.create).not.toHaveBeenCalled();
  });
});

describe("EnquiriesService.get — per-audience internal-notes gating", () => {
  const events = [
    makeEvent({ id: "pub", internalOnly: false }),
    makeEvent({ id: "int", internalOnly: true }),
  ];

  it("gives a reader with enquiry_notes (HT) notes_internal and every event", async () => {
    const view = await build(makeRow(), events).service.get(staff(["HT"]), access, "enq-1");
    expect(view.notesInternal).toBe("internal only");
    expect(view.events).toHaveLength(2);
  });

  it("omits notes_internal and internal-only events for a reader without it (FA)", async () => {
    const view = await build(makeRow(), events).service.get(staff(["FA"]), access, "enq-1");
    expect(view).not.toHaveProperty("notesInternal");
    expect(view.events).toHaveLength(1);
    expect(view.events[0]?.id).toBe("pub");
  });
});
