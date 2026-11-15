import { fireEvent, screen } from "../../test/render";
import { FinanceScreen } from "./finance-screen";
import { fakeFinanceApi, renderWithApi } from "./finance.test-utils";

// The web workspace saves the file; the test keeps what would have been saved.
const mockDownloadCsv = jest.fn<boolean, [string, string]>(() => true);
jest.mock("../admin/download-csv", () => ({
  downloadCsv: (filename: string, csv: string) => mockDownloadCsv(filename, csv),
}));

describe("FinanceScreen export (§5.16, D-128)", () => {
  beforeEach(() => {
    mockDownloadCsv.mockClear();
    mockDownloadCsv.mockReturnValue(true);
  });

  it("exports the tab's subscriptions as a CSV for Finance, through the audited export", async () => {
    const api = fakeFinanceApi({ roles: ["FA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    await fireEvent.press(await screen.findByTestId("finance-export"));
    expect(await screen.findByText("Exported 2 subscriptions")).toBeOnTheScreen();
    expect(api.asked).toContain("/crm/reports/subscriptions/export?status=pending_payment");
    const [filename, csv] = mockDownloadCsv.mock.calls[0]!;
    expect(filename).toBe("subscriptions-awaiting-payment.csv");
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain("Nisha & Arjun,Hotel Discovery,Pending payment,50000.00");
  });

  it("exports everything from the All tab", async () => {
    const api = fakeFinanceApi({ roles: ["SA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    await screen.findByText("Prasad & Partner");
    await fireEvent.press(screen.getByRole("tab", { name: "All" }));
    await fireEvent.press(screen.getByTestId("finance-export"));
    expect(await screen.findByText("Exported 3 subscriptions")).toBeOnTheScreen();
    expect(api.asked).toContain("/crm/reports/subscriptions/export");
    expect(mockDownloadCsv.mock.calls[0]![0]).toBe("subscriptions.csv");
  });

  it("says to export from the web where a file cannot be saved", async () => {
    mockDownloadCsv.mockReturnValue(false);
    await renderWithApi(<FinanceScreen />, fakeFinanceApi({ roles: ["FA"] }).fetch);
    await fireEvent.press(await screen.findByTestId("finance-export"));
    expect(await screen.findByText("Export from the web workspace")).toBeOnTheScreen();
  });

  it("offers Sales no export: it may run the report, not export it", async () => {
    await renderWithApi(<FinanceScreen />, fakeFinanceApi({ roles: ["SM"] }).fetch);
    expect(await screen.findByText("Prasad & Partner")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-export")).toBeNull();
    expect(screen.getByTestId("finance-record-payment")).toBeOnTheScreen();
  });
});
