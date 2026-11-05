import { describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@ampm/policy";

import type { Access } from "../../../common/request-context.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { PrincipalService } from "../../../policy/principal.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import {
  type AgreementRow,
  type AgreementWriteData,
  ServiceAgreementsRepository,
} from "./service-agreements.repository.js";
import { ServiceAgreementsService } from "./service-agreements.service.js";

function makeRow(over: Partial<AgreementRow> = {}): AgreementRow {
  return {
    id: "agr-1",
    accountId: "acc-1",
    projectId: null,
    serviceTypeId: "st-1",
    hotelEnquiryId: "enq-1",
    scopeText: "Negotiate rates and block for the February wedding.",
    feeAmount: new Prisma.Decimal("25000"),
    feeStructure: "fixed",
    currency: "INR",
    termsVersion: "v1",
    status: "draft",
    acceptedAt: null,
    acceptedByUserId: null,
    documentId: null,
    createdBy: "sales-1",
    createdAt: new Date("2026-11-05T00:00:00Z"),
    updatedAt: new Date("2026-11-05T00:00:00Z"),
    serviceType: {
      serviceKey: "negotiation",
      name: "Rate negotiation",
      category: "hotel_assistance",
    },
    ...over,
  };
}

function staff(roles: StaffRole[] = ["SM"], userId = "sales-1"): Principal {
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

const access: Access = { key: "crm.service_agreements.update", scope: "all" };

function build(row: AgreementRow = makeRow()) {
  const repo = {
    serviceTypeCategory: vi.fn(async (): Promise<string | null> => "hotel_assistance"),
    create: vi.fn(async (_data: AgreementWriteData) => row),
    findByIdInScope: vi.fn(async () => row),
    findByIdForAccount: vi.fn(async () => row),
    updateTerms: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => 1),
    accountClientUserIds: vi.fn(async () => ["client-user-1", "client-user-2"]),
    hasActiveForEnquiry: vi.fn(async () => true),
  };
  const prisma = { $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}) };
  const audit = { record: vi.fn(async () => undefined) };
  const principals = { invalidateEntitlements: vi.fn() };
  const service = new ServiceAgreementsService(
    repo as unknown as ServiceAgreementsRepository,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    principals as unknown as PrincipalService,
  );
  return { service, repo, audit, principals };
}

describe("ServiceAgreementsService.create", () => {
  it("rejects an unknown or inactive service type (validation, not a dangling FK)", async () => {
    const { service, repo } = build();
    repo.serviceTypeCategory.mockResolvedValueOnce(null);
    await expect(
      service.create(staff(), {
        accountId: "acc-1",
        serviceTypeId: "nope",
        hotelEnquiryId: null,
        scopeText: "x",
        fee: { minor: 2500000, currency: "INR" },
        feeStructure: "fixed",
        termsVersion: null,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates a draft and audits it, storing the fee as a rupee decimal", async () => {
    const { service, repo, audit } = build();
    await service.create(staff(), {
      accountId: "acc-1",
      serviceTypeId: "st-1",
      hotelEnquiryId: "enq-1",
      scopeText: "Negotiate rates.",
      fee: { minor: 2500000, currency: "INR" },
      feeStructure: "fixed",
      termsVersion: "v1",
    });
    expect(repo.create).toHaveBeenCalledOnce();
    const data = repo.create.mock.calls[0]?.[0];
    expect(data?.feeAmount.toNumber()).toBe(25000);
    expect(audit.record).toHaveBeenCalledOnce();
  });
});

describe("ServiceAgreementsService.updateTerms", () => {
  it("edits a draft's terms", async () => {
    const { service, repo } = build(makeRow({ status: "draft" }));
    await service.updateTerms(staff(), access, "agr-1", { scopeText: "New scope" });
    expect(repo.updateTerms).toHaveBeenCalledOnce();
  });

  it("refuses to edit terms once the agreement is past draft (immutable once shared)", async () => {
    const { service, repo } = build(makeRow({ status: "sent" }));
    await expect(
      service.updateTerms(staff(), access, "agr-1", { scopeText: "New scope" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.updateTerms).not.toHaveBeenCalled();
  });
});

describe("ServiceAgreementsService.transition (hand-rolled machine)", () => {
  it("allows a defined move (draft → sent) and does not touch entitlements", async () => {
    const { service, repo, principals } = build(makeRow({ status: "draft" }));
    await service.transition(staff(), access, "agr-1", { status: "sent" });
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "agr-1",
      "draft",
      expect.objectContaining({ status: "sent" }),
      "sales-1",
      expect.anything(),
    );
    expect(principals.invalidateEntitlements).not.toHaveBeenCalled();
  });

  it("refuses an undefined move (draft → active) with a 409", async () => {
    const { service } = build(makeRow({ status: "draft" }));
    await expect(
      service.transition(staff(), access, "agr-1", { status: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses any move on a terminal agreement", async () => {
    const { service } = build(makeRow({ status: "completed" }));
    await expect(
      service.transition(staff(), access, "agr-1", { status: "cancelled" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("busts the entitlement cache for every account client user when activating (accepted → active)", async () => {
    const { service, principals } = build(makeRow({ status: "accepted" }));
    await service.transition(staff(), access, "agr-1", { status: "active" });
    expect(principals.invalidateEntitlements).toHaveBeenCalledWith("client-user-1");
    expect(principals.invalidateEntitlements).toHaveBeenCalledWith("client-user-2");
  });

  it("busts the entitlement cache when leaving active (active → completed)", async () => {
    const { service, principals } = build(makeRow({ status: "active" }));
    await service.transition(staff(), access, "agr-1", { status: "completed" });
    expect(principals.invalidateEntitlements).toHaveBeenCalledTimes(2);
  });

  it("fails cleanly (409) when the row moved underneath a concurrent transition (CAS miss)", async () => {
    const { service, repo, principals } = build(makeRow({ status: "accepted" }));
    repo.updateStatus.mockResolvedValueOnce(0); // another transaction already moved it
    await expect(
      service.transition(staff(), access, "agr-1", { status: "active" }),
    ).rejects.toMatchObject({ code: "conflict" });
    // No entitlement bust on a lost race.
    expect(principals.invalidateEntitlements).not.toHaveBeenCalled();
  });
});

describe("ServiceAgreementsService.accept (client path)", () => {
  it("moves a sent agreement to accepted and records who accepted", async () => {
    const { service, repo } = build(makeRow({ status: "sent" }));
    await service.accept(makeRow({ status: "sent" }), "client-user-1");
    expect(repo.updateStatus).toHaveBeenCalledWith(
      "agr-1",
      "sent",
      expect.objectContaining({ status: "accepted", acceptedByUserId: "client-user-1" }),
      "client-user-1",
      expect.anything(),
    );
  });

  it("refuses to accept an agreement that was not sent", async () => {
    const { service } = build();
    await expect(
      service.accept(makeRow({ status: "draft" }), "client-user-1"),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("ServiceAgreementsService.hasActiveForEnquiry", () => {
  it("delegates the AC-05.7 gate query to the repository", async () => {
    const { service, repo } = build();
    await expect(service.hasActiveForEnquiry("enq-1")).resolves.toBe(true);
    expect(repo.hasActiveForEnquiry).toHaveBeenCalledWith("enq-1");
  });
});
