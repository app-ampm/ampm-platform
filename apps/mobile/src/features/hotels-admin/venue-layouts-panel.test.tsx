import { VENUE_OTHER_LAYOUTS_MAX } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { VenueEditSheet } from "./venue-edit-sheet";
import {
  HOTEL_ID,
  ok,
  renderWithApi,
  routedFetch,
  VENUE_ID,
  venueViewFixture,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  created?: unknown;
  updated?: unknown;
}

function venueFetch(captured: Captured): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}/venues`]: (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(venueViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/venues/${VENUE_ID}`]: (init) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(venueViewFixture());
    },
  });
}

const noop = (): void => {};

/** A new venue with its name and setting given, so only the layouts decide the save. */
async function renderNamedVenue(captured: Captured): Promise<void> {
  await renderWithApi(
    <VenueEditSheet hotelId={HOTEL_ID} open venue={null} onClose={noop} />,
    venueFetch(captured),
  );
  await fireEvent.changeText(await screen.findByTestId("venue-name"), "Synthetic Hall");
  await fireEvent.press(screen.getByTestId("venue-setting-indoor"));
}

async function fillLayout(index: number, name: string, max: string, min = ""): Promise<void> {
  await fireEvent.changeText(screen.getByTestId(`venue-layout-${index}-name`), name);
  await fireEvent.changeText(screen.getByTestId(`venue-layout-${index}-max`), max);
  if (min) await fireEvent.changeText(screen.getByTestId(`venue-layout-${index}-min`), min);
}

describe("VenueEditSheet's other layouts", () => {
  it("adds layouts as rows of a name, the most and the fewest, and removes one", async () => {
    const captured: Captured = {};
    await renderNamedVenue(captured);
    expect(screen.getByTestId("venue-layouts-empty")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    await fillLayout(0, "Classroom", "120");
    await fillLayout(1, "U-shape", "40", "30");
    await fireEvent.press(screen.getByTestId("venue-layout-0-remove"));
    expect(screen.getByTestId("venue-layout-0-name")).toHaveDisplayValue("U-shape");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      otherLayouts: [{ layout: "U-shape", max: 40, min: 30 }],
    });
  });

  it("names a layout's remove button after it, for screen readers", async () => {
    await renderNamedVenue({});
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    expect(screen.getByLabelText("Remove layout 1")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("venue-layout-0-name"), "Cluster");
    expect(screen.getByLabelText("Remove Cluster")).toBeOnTheScreen();
  });

  it("stops at 12 layouts: Add is disabled and the sheet says why", async () => {
    await renderNamedVenue({});
    for (let i = 0; i < VENUE_OTHER_LAYOUTS_MAX; i += 1) {
      await fireEvent.press(screen.getByTestId("venue-layout-add"));
    }
    expect(
      screen.getByTestId(`venue-layout-${VENUE_OTHER_LAYOUTS_MAX - 1}-name`),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("venue-layout-add")).toBeDisabled();
    expect(screen.getByTestId("venue-layouts-full")).toHaveTextContent(
      "That is the most: 12 layouts.",
    );
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    expect(screen.queryByTestId(`venue-layout-${VENUE_OTHER_LAYOUTS_MAX}-name`)).toBeNull();
  });

  it("blocks a save on a row whose fewest is above its most, and on a name given twice", async () => {
    const captured: Captured = {};
    await renderNamedVenue(captured);
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    await fillLayout(0, "Classroom", "40", "50");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(
      await screen.findByText("Other layouts: The fewest guests is above the most"),
    ).toBeOnTheScreen();
    expect(screen.getByText("The fewest guests is above the most")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("venue-layout-0-min"), "");
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    await fillLayout(1, "classroom", "60");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByTestId("venue-layouts-error")).toHaveTextContent(
      "Give each layout once",
    );
    expect(captured.created).toBeUndefined();
  });

  it("drops a row left blank instead of refusing it", async () => {
    const captured: Captured = {};
    await renderNamedVenue(captured);
    await fireEvent.press(screen.getByTestId("venue-layout-add"));
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({ otherLayouts: null });
  });
});
