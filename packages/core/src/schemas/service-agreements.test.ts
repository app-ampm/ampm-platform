import { describe, expect, it } from "vitest";

import { consultancyChargeablePolicy } from "./config.js";
import {
  serviceAgreementAcceptRequest,
  serviceAgreementClientView,
  serviceAgreementCreateRequest,
  serviceAgreementStaffView,
  serviceAgreementUpdateRequest,
} from "./service-agreements.js";

const validClientView = {
  id: "00000000-0000-7000-8000-000000000001",
  serviceKey: "negotiation",
  serviceName: "Rate negotiation",
  category: "hotel_assistance",
  hotelEnquiryId: "00000000-0000-7000-8000-000000000002",
  projectId: null,
  scopeText: "Negotiate rates and block for the February wedding.",
  fee: { minor: 2500000, currency: "INR" },
  feeStructure: "fixed",
  termsVersion: "v1",
  status: "sent",
  acceptedAt: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("serviceAgreementClientView — no internal field on a client route (security.md)", () => {
  it("accepts a well-formed client view", () => {
    expect(serviceAgreementClientView.safeParse(validClientView).success).toBe(true);
  });

  it.each(["accountId", "serviceTypeId", "acceptedByUserId", "documentId", "createdBy"])(
    "rejects the internal field %s (additionalProperties:false)",
    (key) => {
      const withInternal = { ...validClientView, [key]: null };
      expect(serviceAgreementClientView.safeParse(withInternal).success).toBe(false);
    },
  );

  it("is a strict subset of the staff view (same client fields parse under staff)", () => {
    const staff = {
      ...validClientView,
      accountId: "00000000-0000-7000-8000-000000000003",
      serviceTypeId: "00000000-0000-7000-8000-000000000004",
      acceptedByUserId: null,
      documentId: null,
      createdBy: null,
    };
    expect(serviceAgreementStaffView.safeParse(staff).success).toBe(true);
  });
});

describe("serviceAgreementCreateRequest", () => {
  const base = {
    accountId: "00000000-0000-7000-8000-000000000003",
    serviceTypeId: "00000000-0000-7000-8000-000000000004",
    hotelEnquiryId: "00000000-0000-7000-8000-000000000002",
    scopeText: "Negotiate rates.",
    fee: { minor: 2500000, currency: "INR" },
    feeStructure: "fixed",
    termsVersion: "v1",
  };

  it("accepts a well-formed request", () => {
    expect(serviceAgreementCreateRequest.safeParse(base).success).toBe(true);
  });

  it("rejects a negative fee", () => {
    const r = serviceAgreementCreateRequest.safeParse({
      ...base,
      fee: { minor: -1, currency: "INR" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a fee that would overflow the numeric(14,2) column", () => {
    const r = serviceAgreementCreateRequest.safeParse({
      ...base,
      fee: { minor: 100_000_000_000_000, currency: "INR" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown service_key (not in the v1 enum)", () => {
    const r = serviceAgreementCreateRequest.safeParse({ ...base, serviceKey: "spa" });
    expect(r.success).toBe(false); // strict object rejects the extra key
  });

  it("defaults hotelEnquiryId to null when omitted", () => {
    const { hotelEnquiryId: _omit, ...rest } = base;
    const r = serviceAgreementCreateRequest.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.hotelEnquiryId).toBeNull();
  });
});

describe("serviceAgreementUpdateRequest — fee bounds mirror create", () => {
  it("accepts a well-formed partial update", () => {
    expect(serviceAgreementUpdateRequest.safeParse({ scopeText: "Revised scope" }).success).toBe(
      true,
    );
  });

  it("rejects a negative or out-of-range fee on update (not only on create)", () => {
    expect(
      serviceAgreementUpdateRequest.safeParse({ fee: { minor: -500000, currency: "INR" } }).success,
    ).toBe(false);
    expect(
      serviceAgreementUpdateRequest.safeParse({
        fee: { minor: 100_000_000_000_000, currency: "INR" },
      }).success,
    ).toBe(false);
  });
});

describe("serviceAgreementAcceptRequest — explicit consent only", () => {
  it("accepts termsAccepted:true", () => {
    expect(serviceAgreementAcceptRequest.safeParse({ termsAccepted: true }).success).toBe(true);
  });

  it("rejects termsAccepted:false and a missing flag", () => {
    expect(serviceAgreementAcceptRequest.safeParse({ termsAccepted: false }).success).toBe(false);
    expect(serviceAgreementAcceptRequest.safeParse({}).success).toBe(false);
  });
});

describe("consultancyChargeablePolicy (R8)", () => {
  it("parses the baseline keys and rejects an unknown key", () => {
    expect(
      consultancyChargeablePolicy.safeParse({
        chargeableServiceKeys: ["negotiation", "site_visit"],
      }).success,
    ).toBe(true);
    expect(consultancyChargeablePolicy.safeParse({ chargeableServiceKeys: ["spa"] }).success).toBe(
      false,
    );
  });
});
