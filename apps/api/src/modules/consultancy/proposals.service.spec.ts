import { describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@ampm/policy";

import type { Access } from "../../common/request-context.js";
import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { EventBus } from "../../jobs/event-bus.js";
import { AuditService } from "../../policy/audit.service.js";
import type { Principal } from "../../policy/principal.types.js";
import { EnquiriesRepository, type EnquiryRow } from "./enquiries.repository.js";
import { EnquiriesService } from "./enquiries.service.js";
import {
  type ProposalRow,
  ProposalsRepository,
  type ProposalWriteData,
} from "./proposals.repository.js";
import { ProposalsService } from "./proposals.service.js";

function makeEnquiry(over: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id: "enq-1",
    accountId: "acc-1",
    projectId: null,
    hotelId: "hot-1",
    requestedByUserId: "usr-1",
    assignedUserId: null,
    serviceAgreementId: null,
    status: "proposal_received",
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

function makeProposal(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: "prop-1",
    enquiryId: "enq-1",
    hotelId: "hot-1",
    versionNumber: 1,
    status: "draft",
    validUntil: null,
    clientTotalAmount: new Prisma.Decimal("50000"),
    internalTotalAmount: new Prisma.Decimal("42000"),
    currency: "INR",
    documentId: null,
    sharedAt: null,
    decidedAt: null,
    decidedByUserId: null,
    approvalId: null,
    supersedesProposalId: null,
    createdBy: "sa-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: "l1",
        proposalId: "prop-1",
        itemType: "venue_rental",
        description: "Lawn",
        quantity: new Prisma.Decimal("1"),
        unitAmount: new Prisma.Decimal("10000"),
        totalAmount: new Prisma.Decimal("10000"),
        clientVisible: true,
      },
    ],
    ...over,
  };
}

function staff(roles: StaffRole[], userId = "sa-1"): Principal {
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

const access: Access = { key: "consultancy.proposals.update", scope: "all" };
const INR = (minor: number) => ({ minor, currency: "INR" as const });

function build(proposal: ProposalRow = makeProposal(), enquiry: EnquiryRow = makeEnquiry()) {
  const created = makeProposal({ id: "prop-2", versionNumber: 2, supersedesProposalId: "prop-1" });
  const proposals = {
    nextVersion: vi.fn(async () => 2),
    create: vi.fn(async (_d: ProposalWriteData) => created),
    findById: vi.fn(async () => proposal),
    findByIdInScope: vi.fn(async () => proposal),
    listStaff: vi.fn(async () => ({ rows: [proposal], nextCursor: null })),
    listForEnquiry: vi.fn(async () => ({ rows: [proposal], nextCursor: null })),
    liveProposalExists: vi.fn(async () => false),
    updateDraft: vi.fn(async () => 1),
    updateStatus: vi.fn(async () => 1),
  };
  const enquiriesRepo = { findByIdInScope: vi.fn(async (): Promise<EnquiryRow | null> => enquiry) };
  const enquiries = { transition: vi.fn(async () => ({})) };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const audit = { record: vi.fn(async () => undefined) };
  const bus = { emit: vi.fn(async () => undefined) };
  const logger = { warn: vi.fn() };
  const service = new ProposalsService(
    proposals as unknown as ProposalsRepository,
    enquiriesRepo as unknown as EnquiriesRepository,
    enquiries as unknown as EnquiriesService,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    bus as unknown as EventBus,
    logger as unknown as AppLogger,
  );
  return { service, proposals, enquiries, bus };
}

describe("ProposalsService.get — internal total gated on read_internal_amount", () => {
  it("includes internalTotal + margin for a holder (SA)", async () => {
    const { service } = build();
    const view = await service.get(staff(["SA"]), access, "prop-1");
    expect(view.internalTotal).toMatchObject(INR(4200000));
    expect(view.margin).toMatchObject(INR(800000)); // 50000 − 42000 = 8000 rupees
  });

  it("omits internalTotal + margin for a reader without the grant (SM)", async () => {
    const { service } = build();
    const view = await service.get(staff(["SM"]), access, "prop-1");
    expect(view).not.toHaveProperty("internalTotal");
    expect(view).not.toHaveProperty("margin");
    expect(view.clientTotal).toMatchObject(INR(5000000)); // SM still sees the client total
  });
});

describe("ProposalsService.create", () => {
  const req = {
    enquiryId: "enq-1",
    validUntil: null,
    clientTotal: INR(5000000),
    internalTotal: INR(4200000),
    lines: [],
  };

  it("creates version 1 with the enquiry's hotel", async () => {
    const { service, proposals } = build();
    await service.create(staff(["SA"]), access, req);
    const [data] = proposals.create.mock.calls[0]!;
    expect(data.hotelId).toBe("hot-1");
    expect(data.clientTotalAmount).toBe("50000.00");
  });

  it("refuses a second live proposal for an enquiry (revise instead)", async () => {
    const { service, proposals } = build();
    proposals.liveProposalExists.mockResolvedValueOnce(true);
    await expect(service.create(staff(["SA"]), access, req)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(proposals.create).not.toHaveBeenCalled();
  });
});

describe("ProposalsService.update — draft-only (AC-09)", () => {
  it("refuses to edit a shared proposal", async () => {
    const { service } = build(makeProposal({ status: "shared" }));
    await expect(
      service.update(staff(["SA"]), access, "prop-1", { clientTotal: INR(1) }),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("fails cleanly (409) when a concurrent share flipped the draft mid-edit (CAS miss)", async () => {
    const { service, proposals } = build(makeProposal({ status: "draft" }));
    proposals.updateDraft.mockResolvedValueOnce(0); // the row moved to shared between the read and the write
    await expect(
      service.update(staff(["SA"]), access, "prop-1", { clientTotal: INR(1) }),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });
});

describe("ProposalsService.share", () => {
  it("shares a draft, advances the enquiry (HT at proposal_received) and emits the event", async () => {
    const { service, proposals, enquiries, bus } = build(makeProposal({ status: "draft" }));
    await service.share(staff(["HT", "SA"]), access, "prop-1");
    expect(proposals.updateStatus).toHaveBeenCalledWith(
      "prop-1",
      "draft",
      expect.objectContaining({ status: "shared" }),
      "sa-1",
      expect.anything(),
    );
    expect(enquiries.transition).toHaveBeenCalledWith(
      expect.anything(),
      access,
      "enq-1",
      expect.objectContaining({ status: "client_decision" }),
    );
    expect(bus.emit).toHaveBeenCalled();
  });

  it("refuses to share a non-draft proposal", async () => {
    const { service } = build(makeProposal({ status: "shared" }));
    await expect(service.share(staff(["HT"]), access, "prop-1")).rejects.toMatchObject({
      code: "conflict",
    });
  });
});

describe("ProposalsService.revise", () => {
  it("creates a new version that supersedes the predecessor", async () => {
    const { service, proposals } = build(makeProposal({ status: "shared" }));
    await service.revise(staff(["SA"]), access, "prop-1");
    const [data] = proposals.create.mock.calls[0]!;
    expect(data.supersedesProposalId).toBe("prop-1");
    expect(proposals.updateStatus).toHaveBeenCalledWith(
      "prop-1",
      "shared",
      { status: "superseded" },
      "sa-1",
      expect.anything(),
    );
  });

  it("refuses to revise a draft (nothing to supersede yet)", async () => {
    const { service } = build(makeProposal({ status: "draft" }));
    await expect(service.revise(staff(["SA"]), access, "prop-1")).rejects.toMatchObject({
      code: "conflict",
    });
  });
});

describe("ProposalsService.decide", () => {
  it("accepts a shared proposal and records who decided", async () => {
    const { service, proposals } = build();
    await service.decide(makeProposal({ status: "shared" }), "client-1", "acc-1", "accepted");
    expect(proposals.updateStatus).toHaveBeenCalledWith(
      "prop-1",
      "shared",
      expect.objectContaining({ status: "accepted", decidedByUserId: "client-1" }),
      "client-1",
      expect.anything(),
    );
  });

  it("blocks accept/decline of an expired proposal (409) but allows a revision request", async () => {
    const { service, proposals } = build();
    const expired = makeProposal({ status: "shared", validUntil: new Date("2020-01-01") });
    await expect(service.decide(expired, "client-1", "acc-1", "accepted")).rejects.toMatchObject({
      code: "conflict",
    });
    await service.decide(expired, "client-1", "acc-1", "revision_requested");
    expect(proposals.updateStatus).toHaveBeenCalledWith(
      "prop-1",
      "shared",
      { status: "revision_requested" },
      "client-1",
      expect.anything(),
    );
  });

  it("refuses to decide a non-shared proposal", async () => {
    const { service } = build();
    await expect(
      service.decide(makeProposal({ status: "draft" }), "client-1", "acc-1", "accepted"),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("fails cleanly (409) on a concurrent CAS miss", async () => {
    const { service, proposals } = build();
    proposals.updateStatus.mockResolvedValueOnce(0);
    await expect(
      service.decide(makeProposal({ status: "shared" }), "client-1", "acc-1", "accepted"),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });
});
