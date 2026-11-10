import type { HotelImportResult } from "@ampm/core";

import { jsonResponse } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { HotelImportScreen } from "./hotel-import-screen";
import { pickCsvFile } from "./pick-csv-file";
import { ok, renderWithApi, routedFetch, type FetchFn } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

beforeEach(() => {
  jest.mocked(pickCsvFile).mockReset();
});

const IMPORT_PATH = "/hotels-admin/imports";
const JOB_ID = "018f0000-0000-7000-8000-00000000f001";
const rejected = [{ line: 2, errors: [{ field: "name", message: "required" }] }];

const dryResult: HotelImportResult = {
  importJobId: JOB_ID,
  dryRun: true,
  applied: false,
  totalRows: 3,
  created: 0,
  updated: 0,
  destinationsCreated: 0,
  mediaRegistered: 0,
  rejected,
};
const appliedResult: HotelImportResult = {
  importJobId: JOB_ID,
  dryRun: false,
  applied: true,
  totalRows: 3,
  created: 2,
  updated: 0,
  destinationsCreated: 1,
  mediaRegistered: 0,
  rejected,
};

interface Captured {
  bodies: unknown[];
}

const importFetch = (captured: Captured): FetchFn =>
  routedFetch({
    [IMPORT_PATH]: (init) => {
      const body = JSON.parse(String(init?.body)) as { dryRun: boolean };
      captured.bodies.push(body);
      return ok(body.dryRun ? dryResult : appliedResult);
    },
  });

async function renderImport(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<HotelImportScreen />, fetchImpl);
}

const CSV = "destinationSlug,name\nudaipur,Taj Lake Palace\n,Bad Row\ngoa,Candolim Beach";

describe("HotelImportScreen", () => {
  it("validates the CSV as a dry run and reports rejected rows without saving", async () => {
    const captured: Captured = { bodies: [] };
    await renderImport(importFetch(captured));
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    expect(
      await screen.findByText("Checked 3 rows: 2 valid, 1 rejected — nothing saved yet."),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-rejected-2")).toBeOnTheScreen();
    expect(screen.getByText("Line 2: name — required")).toBeOnTheScreen();
    // The dry-run outcome is announced (its own live toast), not only shown in the panel.
    expect(screen.getByText("Validated — some rows rejected")).toBeOnTheScreen();
    expect(captured.bodies).toEqual([{ content: CSV, dryRun: true }]);
  });

  it("imports the valid rows with a success toast and the applied summary", async () => {
    const captured: Captured = { bodies: [] };
    await renderImport(importFetch(captured));
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Hotels imported")).toBeOnTheScreen();
    expect(
      screen.getByText("Imported 2 created · 0 updated · 1 new destinations."),
    ).toBeOnTheScreen();
    expect(captured.bodies).toEqual([{ content: CSV, dryRun: false }]);
  });

  it("blocks an empty run and sends nothing", async () => {
    const captured: Captured = { bodies: [] };
    await renderImport(importFetch(captured));
    await fireEvent.press(await screen.findByTestId("hotel-import-run"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(captured.bodies).toEqual([]);
  });

  it("surfaces the server's message in a toast when the import is refused", async () => {
    await renderImport(
      routedFetch({
        [IMPORT_PATH]: () =>
          jsonResponse({ error: { code: "forbidden", message: "You cannot import hotels." } }, 403),
      }),
    );
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("You cannot import hotels.")).toBeOnTheScreen();
  });

  it("fills the content and file-name hint from a chosen CSV, clearing the hint on manual edit", async () => {
    jest.mocked(pickCsvFile).mockResolvedValue({ content: CSV, name: "hotels.csv" });
    await renderImport(importFetch({ bodies: [] }));
    await fireEvent.press(await screen.findByTestId("hotel-import-choose"));
    expect(await screen.findByText("hotels.csv")).toBeOnTheScreen();
    expect(await screen.findByDisplayValue(CSV)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("hotel-import-content"), CSV + "\nextra,row");
    expect(screen.queryByText("hotels.csv")).not.toBeOnTheScreen();
  });

  it("leaves the form empty when the file picker returns nothing", async () => {
    const captured: Captured = { bodies: [] };
    jest.mocked(pickCsvFile).mockResolvedValue(null);
    await renderImport(importFetch(captured));
    await fireEvent.press(await screen.findByTestId("hotel-import-choose"));
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(captured.bodies).toEqual([]);
  });

  it("blocks a whitespace-only run and sends nothing", async () => {
    const captured: Captured = { bodies: [] };
    await renderImport(importFetch(captured));
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), "   \n  \t");
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(captured.bodies).toEqual([]);
  });
});
