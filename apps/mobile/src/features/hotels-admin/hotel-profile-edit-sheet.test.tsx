import { fireEvent, screen } from "../../test/render";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import {
  DESTINATION_ID,
  destinationViewFixture,
  failure,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  hotelStaffViewFixture,
  ok,
  renderWithApi,
  routedFetch,
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

function editorFetch(captured: Captured): FetchFn {
  return routedFetch({
    "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
    "/hotels-admin/hotels": (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(hotelStaffDetailViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}`]: (init) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(hotelStaffDetailViewFixture());
    },
  });
}

const noop = (): void => {};

describe("HotelProfileEditSheet", () => {
  it("adds a hotel: fills the name, picks a destination and posts the profile", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <HotelProfileEditSheet open hotel={null} onClose={noop} />,
      editorFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("hotel-name"), "Cliff House");
    await fireEvent.press(await screen.findByTestId("hotel-destination"));
    await fireEvent.press(await screen.findByTestId(`hotel-destination-option-${DESTINATION_ID}`));
    await fireEvent.press(screen.getByTestId("hotel-profile-submit"));
    expect(await screen.findByText("Hotel added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Cliff House",
      destinationId: DESTINATION_ID,
      status: "draft",
    });
  });

  it("blocks submit and names a missing required field", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <HotelProfileEditSheet open hotel={null} onClose={noop} />,
      editorFetch(captured),
    );
    await fireEvent.press(await screen.findByTestId("hotel-profile-submit"));
    expect(await screen.findByText("Give the hotel a name")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a hotel: seeds from its profile and patches the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
      editorFetch(captured),
    );
    await screen.findByDisplayValue("The Lakeside Palace");
    await fireEvent.changeText(screen.getByTestId("hotel-rooms"), "150");
    await fireEvent.press(screen.getByTestId("hotel-profile-submit"));
    expect(await screen.findByText("Hotel updated")).toBeOnTheScreen();
    expect(captured.updated).toMatchObject({ name: "The Lakeside Palace", totalRooms: 150 });
  });

  it("lets staff retry when the destinations fail to load", async () => {
    let calls = 0;
    const fetch = routedFetch({
      "/hotels-admin/destinations": () => {
        calls += 1;
        return calls === 1 ? failure("internal", 500) : ok({ items: [destinationViewFixture()] });
      },
    });
    await renderWithApi(<HotelProfileEditSheet open hotel={null} onClose={noop} />, fetch);
    await fireEvent.press(await screen.findByTestId("hotel-destination-retry"));
    expect(await screen.findByTestId("hotel-destination")).toBeOnTheScreen();
  });

  it("guides staff to add a destination first when none exist", async () => {
    await renderWithApi(
      <HotelProfileEditSheet open hotel={null} onClose={noop} />,
      routedFetch({ "/hotels-admin/destinations": () => ok({ items: [] }) }),
    );
    expect(await screen.findByText("Add a destination before filing a hotel.")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-destination")).toBeNull();
  });
});
