import { ROOM_IMPORT_COLUMNS } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelImportScreen } from "./hotel-import-screen";
import {
  IMPORT_CSV,
  IMPORT_JOB_ID,
  importFetch,
  ROOMS_CSV,
  type ImportRequest,
} from "./hotel-import.test-utils";
import { renderWithApi } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

async function validate(csv: string): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), csv);
  await fireEvent.press(screen.getByTestId("hotel-import-validate"));
}

describe("HotelImportScreen's kinds", () => {
  it("offers Hotels, Rooms and Venues to the Hotel team, Hotels first", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    expect(await screen.findByTestId("hotel-import-kind-hotels")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-kind-rooms")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-kind-venues")).toBeOnTheScreen();
    expect(screen.getByText("Hotels CSV columns")).toBeOnTheScreen();
  });

  it("offers only the kinds a custom role may import (D-164)", async () => {
    const me = staffMeFixture([], ["hotels.room_categories_venues.create:all"]);
    await renderWithApi(<HotelImportScreen />, importFetch([], { me }));
    expect(await screen.findByTestId("hotel-import-kind-rooms")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-kind-venues")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-import-kind-hotels")).toBeNull();
    expect(screen.getByText("Rooms CSV columns")).toBeOnTheScreen();
  });

  it("says there is nothing to import for a role that may import no kind", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([], { me: staffMeFixture(["SM"]) }));
    expect(await screen.findByTestId("hotel-import-none")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-import-content")).toBeNull();
  });

  it("previews rooms at their own address, with each row's room named", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await fireEvent.press(await screen.findByTestId("hotel-import-kind-rooms"));
    expect(screen.getByTestId("hotel-import-columns-list")).toHaveTextContent(
      ROOM_IMPORT_COLUMNS.join(", "),
    );
    await validate(ROOMS_CSV);
    expect(await screen.findByText("2 room categories to add or update")).toBeOnTheScreen();
    expect(requests[0]?.path).toBe("/hotels-admin/imports/rooms?dryRun=true");
    expect(screen.getByTestId("hotel-import-row-2")).toHaveTextContent(
      "Line 2 · synthetic-lake-hotel · Synthetic Garden Suite · Update: sizeSqm, sizeSqft",
    );
    expect(screen.getByTestId("hotel-import-row-3")).toHaveTextContent(
      "Line 3 · synthetic-lake-hotel · Synthetic Tent · New room category: name, unitType",
    );
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Room categories imported")).toBeOnTheScreen();
    expect(requests[1]?.path).toBe(`/hotels-admin/imports/rooms/${IMPORT_JOB_ID}/apply`);
  });

  it("locks Import and clears the report when the kind changes after a Validate", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await validate(IMPORT_CSV);
    expect(await screen.findByTestId("hotel-import-result")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-import-kind-venues"));
    expect(screen.queryByTestId("hotel-import-result")).toBeNull();
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
    expect(screen.getByTestId("hotel-import-content")).toHaveDisplayValue(IMPORT_CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toHaveLength(1);
  });

  it("names the venues' cell rules: enum values, one number per capacity, the layouts, the units", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-kind-venues"));
    const rules = screen.getByTestId("hotel-import-rules");
    expect(rules).toHaveTextContent(/setting takes indoor, outdoor or semi_open/);
    expect(rules).toHaveTextContent(/Each capacity cell takes one number/);
    expect(rules).toHaveTextContent(/Classroom: 120 \| U-shape: 30-40/);
    expect(rules).toHaveTextContent(/areaSqft gives areaSqm/);
    expect(rules).toHaveTextContent(/A preview can be imported for 24 hours/);
  });
});

describe("HotelImportScreen when an import is refused", () => {
  it.each([
    ["conflict", 409, "This preview was already imported"],
    ["conflict", 409, "This preview has expired; validate the file again"],
    // A race for a web address rolled the import back; the API's word now matches what the screen does.
    [
      "conflict",
      409,
      "Another change took one of these web addresses while the import ran; validate the file again",
    ],
    ["not_found", 404, "Not found"],
  ])(
    "clears the validation on a %s (%i) and says why, until Validate runs again",
    async (code, status, message) => {
      const requests: ImportRequest[] = [];
      await renderWithApi(
        <HotelImportScreen />,
        importFetch(requests, { applied: { code, message, status } }),
      );
      await validate(IMPORT_CSV);
      await screen.findByTestId("hotel-import-result");
      await fireEvent.press(screen.getByTestId("hotel-import-run"));
      expect(await screen.findByTestId("hotel-import-locked")).toHaveTextContent(message);
      expect(screen.queryByTestId("hotel-import-result")).toBeNull();
      expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
      await fireEvent.press(screen.getByTestId("hotel-import-validate"));
      await screen.findByTestId("hotel-import-result");
      expect(screen.getByTestId("hotel-import-run")).toBeEnabled();
      expect(requests.map((request) => request.path)).toEqual([
        "/hotels-admin/imports/hotels?dryRun=true",
        `/hotels-admin/imports/hotels/${IMPORT_JOB_ID}/apply`,
        "/hotels-admin/imports/hotels?dryRun=true",
      ]);
    },
  );

  it("keeps the preview importable after a failure that does not spend it", async () => {
    const applied = { code: "internal", message: "Something went wrong", status: 500 };
    await renderWithApi(<HotelImportScreen />, importFetch([], { applied }));
    await validate(IMPORT_CSV);
    await screen.findByTestId("hotel-import-result");
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-run")).toBeEnabled();
  });
});
