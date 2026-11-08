import {
  paymentAmountLabel,
  paymentDirectionLabel,
  paymentDirectionTone,
  paymentMethodLabel,
  paymentPaidLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from "./payments.format";

describe("payments.format", () => {
  it("labels and tones the direction", () => {
    expect(paymentDirectionLabel("inbound")).toBe("Inbound");
    expect(paymentDirectionLabel("outbound")).toBe("Outbound");
    expect(paymentDirectionTone("inbound")).toBe("success");
    expect(paymentDirectionTone("outbound")).toBe("info");
  });

  it("labels the purpose and the method, including the online gateway", () => {
    expect(paymentPurposeLabel("subscription")).toBe("Subscription");
    expect(paymentPurposeLabel("vendor_payment")).toBe("Vendor payment");
    expect(paymentMethodLabel("gateway")).toBe("Gateway");
    expect(paymentMethodLabel("bank_transfer")).toBe("Bank transfer");
    expect(paymentMethodLabel("upi")).toBe("UPI");
  });

  it("labels and tones the status", () => {
    expect(paymentStatusLabel("succeeded")).toBe("Succeeded");
    expect(paymentStatusLabel("pending")).toBe("Pending");
    expect(paymentStatusTone("succeeded")).toBe("success");
    expect(paymentStatusTone("failed")).toBe("danger");
  });

  it("formats the amount as an internal rupee figure (25,000.00 → paise)", () => {
    expect(paymentAmountLabel({ minor: 2_500_000, currency: "INR" })).toContain("25,000");
  });

  it("formats the settled date, or marks a pending payment (direction-neutral)", () => {
    expect(paymentPaidLabel("2026-11-08T10:00:00Z")).toMatch(/NOV 2026/);
    expect(paymentPaidLabel(null)).toBe("Pending");
  });
});
