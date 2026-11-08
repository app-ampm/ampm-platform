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

describe("VenueEditSheet", () => {
  it("adds a venue: fills the name, picks a type and posts the body", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <VenueEditSheet hotelId={HOTEL_ID} open venue={null} onClose={noop} />,
      venueFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("venue-name"), "Rose Lawn");
    await fireEvent.press(screen.getByTestId("venue-type-lawn"));
    await fireEvent.changeText(screen.getByTestId("venue-banquet"), "250");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Rose Lawn",
      venueType: "lawn",
      isIndoor: true,
      capacityBanquet: 250,
    });
  });

  it("blocks submit and names the missing name", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <VenueEditSheet hotelId={HOTEL_ID} open venue={null} onClose={noop} />,
      venueFetch(captured),
    );
    await fireEvent.press(await screen.findByTestId("venue-edit-submit"));
    expect(await screen.findByText("Give the venue a name")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a venue: seeds from it and patches the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <VenueEditSheet hotelId={HOTEL_ID} open venue={venueViewFixture()} onClose={noop} />,
      venueFetch(captured),
    );
    await screen.findByDisplayValue("Grand Ballroom");
    await fireEvent.changeText(screen.getByTestId("venue-theatre"), "420");
    await fireEvent.press(screen.getByTestId("venue-edit-submit"));
    expect(await screen.findByText("Venue updated")).toBeOnTheScreen();
    expect(captured.updated).toMatchObject({ name: "Grand Ballroom", capacityTheatre: 420 });
  });
});
