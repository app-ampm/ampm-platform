import { describe, expect, it, vi } from "vitest";

import { AppLogger } from "../../common/logger.service.js";
import type { Access } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { EventBus } from "../../jobs/event-bus.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { milestonePaid } from "./booking-milestones.events.js";
import {
  BookingMilestonesRepository,
  type BookingMilestoneRow,
} from "./booking-milestones.repository.js";
import { BookingMilestonesService } from "./booking-milestones.service.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";

function staff(): Principal {
  return {
    type: "staff",
    userId: "usr-1",
    name: "S",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    roles: [],
  };
}

const access: Access = { key: "consultancy.booking_milestones.read", scope: "all" };

function makeRow(over: Partial<BookingMilestoneRow> = {}): BookingMilestoneRow {
  return {
    id: "mil-1",
    enquiryId: "enq-1",
    projectId: null,
    milestoneType: "advance_paid",
    status: "pending",
    dueAt: null,
    completedAt: null,
    amount: null,
    contractId: null,
    documentId: null,
    createdBy: "usr-1",
    createdAt: new Date("2026-11-05"),
    updatedAt: new Date("2026-11-05"),
    ...over,
  };
}

function build(
  row: BookingMilestoneRow = makeRow(),
  opts: { writeCount?: number; enquiry?: EnquiryRow | null } = {},
) {
  const milestones = {
    findByIdInScope: vi.fn(async () => row),
    create: vi.fn(async () => row),
    update: vi.fn(async () => opts.writeCount ?? 1),
    updateStatus: vi.fn(async () => opts.writeCount ?? 1),
  };
  const enquiriesRepo = {
    findByIdInScope: vi.fn(async () =>
      opts.enquiry === undefined
        ? ({ id: "enq-1", projectId: null } as unknown as EnquiryRow)
        : opts.enquiry,
    ),
  };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const audit = { record: vi.fn(async () => undefined) };
  const bus = { emit: vi.fn(async () => undefined) };
  const logger = { warn: vi.fn(), info: vi.fn() };
  const service = new BookingMilestonesService(
    milestones as unknown as BookingMilestonesRepository,
    enquiriesRepo as unknown as EnquiriesRepository,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    bus as unknown as EventBus,
    logger as unknown as AppLogger,
  );
  return { service, milestones, enquiriesRepo, audit, bus };
}

const create = {
  enquiryId: "enq-1",
  milestoneType: "confirmed",
  dueAt: null,
  amount: null,
  contractId: null,
  documentId: null,
} as const;

describe("BookingMilestonesService.create", () => {
  it("creates the milestone (inheriting the enquiry's project) and audits it", async () => {
    const { service, milestones, audit } = build();
    await service.create(staff(), access, create);
    expect(milestones.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it("404s when the enquiry is out of the staff's scope", async () => {
    const { service } = build(makeRow(), { enquiry: null });
    await expect(service.create(staff(), access, create)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("BookingMilestonesService.update", () => {
  it("409s an edit on a terminal milestone", async () => {
    const { service } = build(makeRow({ status: "done" }));
    await expect(service.update(staff(), access, "mil-1", { amount: null })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("409s when the compare-and-swap changed nothing", async () => {
    const { service } = build(makeRow({ status: "pending" }), { writeCount: 0 });
    await expect(service.update(staff(), access, "mil-1", { dueAt: null })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("records the amount before/after in the audit image (not just `edited: true`)", async () => {
    const { service, audit } = build(makeRow({ status: "pending", amount: null }));
    await service.update(staff(), access, "mil-1", {
      amount: { minor: 2_500_000, currency: "INR" },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityType: "booking_milestone",
        before: expect.objectContaining({ amount: null }),
        after: expect.objectContaining({ amount: "25000.00" }),
      }),
      {},
    );
  });
});

describe("BookingMilestonesService.transition", () => {
  it("409s a terminal milestone", async () => {
    const { service } = build(makeRow({ status: "cancelled" }));
    await expect(
      service.transition(staff(), access, "mil-1", { status: "done" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("409s an undefined move (pending → pending)", async () => {
    const { service } = build(makeRow({ status: "pending" }));
    await expect(
      service.transition(staff(), access, "mil-1", { status: "pending" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("409s a manual move to overdue (the sweep-only state)", async () => {
    const { service } = build(makeRow({ status: "pending" }));
    await expect(
      service.transition(staff(), access, "mil-1", { status: "overdue" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("409s when the compare-and-swap changed nothing", async () => {
    const { service } = build(makeRow({ status: "pending" }), { writeCount: 0 });
    await expect(
      service.transition(staff(), access, "mil-1", { status: "done" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("stamps completed_at and emits `paid` when a payment milestone is marked done", async () => {
    const { service, milestones, bus } = build(
      makeRow({ status: "pending", milestoneType: "advance_paid" }),
    );
    await service.transition(staff(), access, "mil-1", { status: "done" });
    expect(milestones.updateStatus).toHaveBeenCalledWith(
      "mil-1",
      "pending",
      expect.objectContaining({ status: "done", completedAt: expect.any(Date) }),
      "usr-1",
      {},
    );
    expect(bus.emit).toHaveBeenCalledWith(
      milestonePaid,
      expect.objectContaining({ milestoneId: "mil-1" }),
    );
  });

  it("does not emit `paid` for a non-payment milestone marked done", async () => {
    const { service, bus } = build(makeRow({ status: "pending", milestoneType: "hold_placed" }));
    await service.transition(staff(), access, "mil-1", { status: "done" });
    expect(bus.emit).not.toHaveBeenCalled();
  });
});
