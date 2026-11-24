import { RATE_IMPORT_COLUMNS, RUPEES_CELL_MESSAGE } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelImportScreen } from "./hotel-import-screen";
import {
  IMPORT_JOB_ID,
  importFetch,
  RATES_CSV,
  type ImportRequest,
} from "./hotel-import.test-utils";
import { renderWithApi } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

// The web workspace saves the file; the test keeps what would have been saved.
const mockDownloadCsv = jest.fn<boolean, [string, string]>(() => true);
jest.mock("../admin/download-csv", () => ({
  downloadCsv: (filename: string, csv: string) => mockDownloadCsv(filename, csv),
}));

beforeEach(() => mockDownloadCsv.mockClear());

/** Chooses Rates, pastes the CSV and presses Validate, waiting for its report. */
async function validateRates(): Promise<void> {
  await fireEvent.press(await screen.findByTestId("hotel-import-kind-rates"));
  await fireEvent.changeText(screen.getByTestId("hotel-import-content"), RATES_CSV);
  await fireEvent.press(screen.getByTestId("hotel-import-validate"));
  await screen.findByTestId("hotel-import-result");
}

describe("HotelImportScreen's Rates kind", () => {
  it("offers only Rates to a custom role that may add rate cards (D-164)", async () => {
    const me = staffMeFixture([], ["hotels.rate_cards_rate_items.create:all"]);
    await renderWithApi(<HotelImportScreen />, importFetch([], { me }));
    expect(await screen.findByText("Rates CSV columns")).toBeOnTheScreen();
    expect(screen.getAllByRole("tab").map((tab) => tab.props.testID)).toEqual([
      "hotel-import-kind-rates",
    ]);
  });

  it("lists the Rates columns and says how its cells read and where its rates land", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-kind-rates"));
    expect(screen.getByTestId("hotel-import-columns-list")).toHaveTextContent(
      RATE_IMPORT_COLUMNS.join(", "),
    );
    const rules = screen.getByTestId("hotel-import-rules");
    expect(rules).toHaveTextContent(/Rates load only into draft cards/);
    expect(rules).toHaveTextContent(/New items start hidden from clients/);
    expect(rules).toHaveTextContent(/verified on the hotel's Rate cards tab/);
    expect(rules).toHaveTextContent(/such as 12500 or 12,500\.50/);
    expect(rules).toHaveTextContent(/Room rate, Venue rental, Per plate veg, Per plate non-veg/);
  });

  it("previews rates at their own address, each row naming its card, item and room or venue", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await validateRates();
    expect(requests).toEqual([
      {
        path: "/hotels-admin/imports/rates",
        body: RATES_CSV,
        contentType: "application/octet-stream",
      },
    ]);
    expect(screen.getByText("2 rate items to add or update")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-row-2")).toHaveTextContent(
      "Line 2 · synthetic-lake-hotel · 2026-27 · Room rate · Lake View Suite · Update: amount",
    );
    expect(screen.getByTestId("hotel-import-row-3")).toHaveTextContent(
      "Line 3 · synthetic-lake-hotel · 2026-27 · Venue rental · Synthetic Lawn · New item: itemType, venueName, amount, unit",
    );
    expect(screen.getByTestId("hotel-import-rejected-4")).toHaveTextContent(
      `Line 4: amount — ${RUPEES_CELL_MESSAGE}`,
    );
  });

  it("downloads the rates report with each row's card, item type, room and venue", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    await validateRates();
    await fireEvent.press(screen.getByTestId("hotel-import-report"));
    const [filename, csv] = mockDownloadCsv.mock.calls[0] ?? [];
    expect(filename).toBe("rates-import-report.csv");
    expect(csv?.split("\r\n").slice(0, 2)).toEqual([
      "line,hotelSlug,cardName,itemType,room,venue,outcome,changedFields,errors",
      "2,synthetic-lake-hotel,2026-27,Room rate,Lake View Suite,,update,amount,",
    ]);
  });

  it("imports the rates preview by its job id", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await validateRates();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Rates imported")).toBeOnTheScreen();
    expect(requests[1]).toEqual({
      path: `/hotels-admin/imports/rates/${IMPORT_JOB_ID}/apply`,
      body: "{}",
      contentType: "application/json",
    });
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
  });

  it("clears the rates report and locks Import when the kind changes", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await validateRates();
    await fireEvent.press(screen.getByTestId("hotel-import-kind-rooms"));
    expect(screen.queryByTestId("hotel-import-result")).toBeNull();
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("hotel-import-kind-rates"));
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toHaveLength(1);
  });
});
