import { subscriptionReportCsv } from "./finance.csv";
import { activeRow, reportRowFixture } from "./finance.test-utils";

const HEADER =
  "Account,Plan,Status,Amount (INR),Created (UTC),Started (UTC),Ends (UTC),Last payment method," +
  "Last payment status,Paid (UTC),Subscription ID,Account ID";

describe("subscriptionReportCsv", () => {
  it("writes a header and one CRLF row per subscription, the amount in rupees", () => {
    const [header, awaiting, active] = subscriptionReportCsv([
      reportRowFixture({}),
      activeRow(),
    ]).split("\r\n");
    expect(header).toBe(HEADER);
    expect(awaiting).toBe(
      "Prasad & Partner,Hotel Discovery,Pending payment,50000.00,2026-11-15T04:07:35.000Z,,,Gateway," +
        "Initiated,,018f0000-0000-7000-8000-0000000f0001,018f0000-0000-7000-8000-0000000f0101",
    );
    expect(active).toContain(
      ",Active,50000.00,2026-11-15T04:07:35.000Z,2026-11-15T06:00:00.000Z,2026-12-15T06:00:00.000Z,Bank transfer,Succeeded,2026-11-15T06:00:00.000Z,",
    );
  });

  it("keeps paise exact and blanks a subscription that has no payment", () => {
    const row = subscriptionReportCsv([
      reportRowFixture({ amount: { minor: 1_234_505, currency: "INR" }, lastPayment: null }),
    ]).split("\r\n")[1];
    expect(row).toContain(",12345.05,");
    expect(row).toContain(",,,,018f0000");
  });

  it("keeps an account name that would start a formula as text", () => {
    const row = subscriptionReportCsv([reportRowFixture({ accountName: "=cmd|'/c calc'!A1" })]);
    expect(row.split("\r\n")[1]!.startsWith("'=cmd")).toBe(true);
  });
});
