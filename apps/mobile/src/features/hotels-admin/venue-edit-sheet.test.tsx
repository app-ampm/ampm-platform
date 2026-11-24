import { fireEvent, screen, within } from "../../test/render";
import { VENUE_TYPES } from "./subresources.format";
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

async function renderNew(captured: Captured): Promise<void> {
  await renderWithApi(
    <VenueEditSheet hotelId={HOTEL_ID} open venue={null} onClose={noop} />,
    venueFetch(captured),
  );
}

describe("VenueEditSheet", () => {
  it("adds a venue: its type, its setting and a seated capacity, with no indoor flag", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("venue-name"), "Synthetic Lawn");
    await fireEvent.press(screen.getByTestId("venue-type-lawn"));
    await fireEvent.press(screen.getByTestId("venue-setting-outdoor"));
    await fireEvent.changeText(screen.getByTestId("venue-banquet"), "250");
    await fireEvent.changeText(screen.getByTestId("venue-facilities"), "Stage, lights\nBar");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Synthetic Lawn",
      venueType: "lawn",
      setting: "outdoor",
      capacityBanquet: 250,
      facilities: ["Stage, lights", "Bar"],
      otherLayouts: null,
    });
    expect(captured.created).not.toHaveProperty("isIndoor");
  });

  it("asks a new venue for its setting before it saves", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("venue-name"), "Synthetic Terrace");
    expect(screen.getByTestId("venue-setting-indoor")).not.toBeChecked();
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Setting: Choose the venue's setting")).toBeOnTheScreen();
    expect(screen.getByTestId("venue-setting-error")).toHaveTextContent(
      "Choose the venue's setting",
    );
    expect(captured.created).toBeUndefined();
  });

  it("offers every venue type with Other last, and labels what each capacity counts", async () => {
    await renderNew({});
    const chips = within(await screen.findByTestId("venue-type")).getAllByRole("radio");
    expect(chips.map((chip) => chip.props.testID)).toEqual(
      VENUE_TYPES.map((type) => `venue-type-${type}`),
    );
    expect(chips[chips.length - 1]).toHaveTextContent("Other");
    expect(screen.getByTestId("venue-type-meeting_room")).toHaveTextContent("Meeting room");
    expect(screen.getByText("Seated (dinner at round tables)")).toBeOnTheScreen();
    expect(screen.getByText("Theatre (rows of chairs)")).toBeOnTheScreen();
    expect(screen.getByText("Floating (standing reception or cocktails)")).toBeOnTheScreen();
    expect(screen.getByText("Covered or semi-open")).toBeOnTheScreen();
  });

  it("works each area's m² out from its sq ft, and sends the dimensions in metres", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("venue-name"), "Synthetic Hall");
    await fireEvent.press(screen.getByTestId("venue-setting-semi_open"));
    await fireEvent.changeText(screen.getByTestId("venue-area-sqft"), "3000");
    await fireEvent.changeText(screen.getByTestId("venue-prefunction-sqft"), "800");
    await fireEvent.changeText(screen.getByTestId("venue-length"), "30.5");
    await fireEvent.changeText(screen.getByTestId("venue-ceiling"), "4.25");
    expect(screen.getByTestId("venue-area")).toHaveDisplayValue("279");
    expect(screen.getByTestId("venue-prefunction")).toHaveDisplayValue("74");
    expect(screen.getAllByText("Worked out from sq ft")).toHaveLength(2);
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      setting: "semi_open",
      areaSqm: 279,
      areaSqft: 3000,
      prefunctionAreaSqm: 74,
      prefunctionAreaSqft: 800,
      lengthM: 30.5,
      ceilingHeightM: 4.25,
    });
  });

  it("refuses a length past two decimal places", async () => {
    await renderNew({});
    await fireEvent.changeText(await screen.findByTestId("venue-name"), "Synthetic Hall");
    await fireEvent.press(screen.getByTestId("venue-setting-indoor"));
    await fireEvent.changeText(screen.getByTestId("venue-length"), "30.555");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(
      await screen.findByText("Length is in metres, up to 2,000, to two decimals"),
    ).toBeOnTheScreen();
  });

  it("edits a venue: seeds its setting and sends only the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <VenueEditSheet hotelId={HOTEL_ID} open venue={venueViewFixture()} onClose={noop} />,
      venueFetch(captured),
    );
    await screen.findByDisplayValue("Grand Ballroom");
    expect(screen.getByTestId("venue-setting-indoor")).toBeChecked();
    await fireEvent.changeText(screen.getByTestId("venue-theatre"), "420");
    await fireEvent.press(screen.getByTestId("venue-setting-semi_open"));
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue updated")).toBeOnTheScreen();
    expect(captured.updated).toEqual({ capacityTheatre: 420, setting: "semi_open" });
  });
});
