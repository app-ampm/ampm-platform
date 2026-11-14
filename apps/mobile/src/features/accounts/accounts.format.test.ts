import {
  accountCreatedLabel,
  accountDay,
  accountFactsLine,
  accountRowSummary,
  accountStatusLabel,
  accountStatusTone,
  paymentMethodLabel,
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from "./accounts.format";

describe("accounts.format", () => {
  it("labels and tones account and subscription status", () => {
    expect(accountStatusLabel("prospect")).toBe("Prospect");
    expect(accountStatusTone("active")).toBe("success");
    expect(accountStatusTone("suspended")).toBe("warning");
    expect(subscriptionStatusLabel("pending_payment")).toBe("Pending payment");
    expect(subscriptionStatusTone("active")).toBe("success");
    expect(subscriptionStatusTone("pending_payment")).toBe("warning");
  });

  it("labels the manual payment methods", () => {
    expect(paymentMethodLabel("bank_transfer")).toBe("Bank transfer");
    expect(paymentMethodLabel("upi")).toBe("UPI");
    expect(paymentMethodLabel("cheque")).toBe("Cheque");
  });

  it("formats the created label and the screen-reader row summary", () => {
    expect(accountCreatedLabel("2026-11-01T09:00:00Z")).toMatch(/^Added \d+ NOV 2026$/);
    expect(accountDay("2026-11-01T09:00:00Z")).toMatch(/^\d+ NOV 2026$/);
    expect(accountRowSummary("Taj", "active")).toBe("Taj, active");
  });

  it("sets the record header's facts line, skipping a couple not yet named", () => {
    const createdAt = "2026-11-01T09:00:00Z";
    expect(accountFactsLine({ isDemo: false, coupleNames: "Priya & Arjun", createdAt })).toMatch(
      /^Client account · Priya & Arjun · Added \d+ NOV 2026$/,
    );
    expect(accountFactsLine({ isDemo: true, coupleNames: null, createdAt })).toMatch(
      /^Demo account · Added \d+ NOV 2026$/,
    );
  });
});
