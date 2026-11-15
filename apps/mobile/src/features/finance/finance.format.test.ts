import { paymentFinanceViewFixture } from "../accounts/accounts.test-utils";
import {
  financeTabStatus,
  lastAttemptLabel,
  paymentPillLabel,
  recordingSubject,
  reportRowSummary,
} from "./finance.format";
import { activeRow, reportRowFixture } from "./finance.test-utils";

describe("finance.format", () => {
  it("maps each tab to the report's status filter, All to none", () => {
    expect(financeTabStatus("awaiting")).toBe("pending_payment");
    expect(financeTabStatus("active")).toBe("active");
    expect(financeTabStatus("all")).toBeUndefined();
  });

  it("names the last payment, or says there was none", () => {
    expect(lastAttemptLabel(reportRowFixture({}))).toBe("Gateway · Initiated");
    expect(lastAttemptLabel(reportRowFixture({ lastPayment: null }))).toBe("No payment yet");
  });

  it("dates a paid payment's pill and states one still under way", () => {
    const paid = paymentFinanceViewFixture({ paidAt: "2026-11-15T06:00:00.000Z" });
    expect(paymentPillLabel(paid)).toBe("Paid 15 Nov 2026");
    const started = paymentFinanceViewFixture({ status: "initiated", paidAt: null });
    expect(paymentPillLabel(started)).toBe("Initiated");
  });

  it("says whose payment the sheet records, and summarises a row for a screen reader", () => {
    expect(recordingSubject(reportRowFixture({}))).toBe(
      "Prasad & Partner · Hotel Discovery · ₹50,000",
    );
    expect(reportRowSummary(reportRowFixture({}))).toBe(
      "Prasad & Partner, Hotel Discovery, awaiting payment since 15 NOV 2026",
    );
    expect(reportRowSummary(activeRow())).toBe("Meera & Dev, Hotel Discovery, active");
  });
});
