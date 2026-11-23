import type { MeResponse } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import {
  DESTINATION_ID,
  destinationListItemFixture,
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

/** The editor's routes; with a `/me`, the person whose grants decide the internal fields (D-171). */
function editorFetch(captured: Captured, me?: MeResponse): FetchFn {
  return routedFetch({
    ...(me ? { "/me": () => ok(me) } : {}),
    "/hotels-admin/destinations": () => ok({ items: [destinationListItemFixture()] }),
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
const NOTES = "Synthetic internal note";

/** The hotel as a reader of its notes gets it, and as someone who cannot read them does. */
const withNotes = () => hotelStaffViewFixture({ internalRating: 4, internalNotes: NOTES });
function withoutNotes() {
  const { internalRating: _rating, internalNotes: _notes, ...profile } = withNotes();
  return profile;
}

/** Changes the rooms, saves, and waits for the update to land. */
async function saveRoomsChange(): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId("hotel-rooms"), "150");
  await fireEvent.press(screen.getByTestId("hotel-profile-submit"));
  expect(await screen.findByText("Hotel updated")).toBeOnTheScreen();
}

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
        return calls === 1
          ? failure("internal", 500)
          : ok({ items: [destinationListItemFixture()] });
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
    // No way to Destinations unless the screen hands one over (a role that may add destinations).
    expect(screen.queryByTestId("hotel-destination-add")).toBeNull();
  });

  it("offers the way to Destinations when none exist and the role may add one", async () => {
    const onAddDestination = jest.fn();
    await renderWithApi(
      <HotelProfileEditSheet
        open
        hotel={null}
        onClose={noop}
        onAddDestination={onAddDestination}
      />,
      routedFetch({ "/hotels-admin/destinations": () => ok({ items: [] }) }),
    );
    await fireEvent.press(await screen.findByTestId("hotel-destination-add"));
    expect(onAddDestination).toHaveBeenCalledTimes(1);
  });

  describe("the internal rating and notes (D-171)", () => {
    it("shows them to the Hotel team, seeded, and sends what they change", async () => {
      const captured: Captured = {};
      await renderWithApi(
        <HotelProfileEditSheet open hotel={withNotes()} onClose={noop} />,
        editorFetch(captured, staffMeFixture(["HT"])),
      );
      expect(await screen.findByTestId("hotel-internal")).toBeOnTheScreen();
      expect(screen.getByDisplayValue(NOTES)).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByTestId("hotel-internal-rating"), "5");
      await saveRoomsChange();
      expect(captured.updated).toMatchObject({ internalRating: 5, internalNotes: NOTES });
    });

    it("leaves them out of the form and the body for Sales, who reads but may not change them", async () => {
      const captured: Captured = {};
      await renderWithApi(
        <HotelProfileEditSheet open hotel={withNotes()} onClose={noop} />,
        editorFetch(captured, staffMeFixture(["SM"])),
      );
      await screen.findByDisplayValue("The Lakeside Palace");
      await saveRoomsChange();
      expect(screen.queryByTestId("hotel-internal")).toBeNull();
      expect(captured.updated).toMatchObject({ totalRooms: 150 });
      expect(captured.updated).not.toHaveProperty("internalNotes");
      expect(captured.updated).not.toHaveProperty("internalRating");
    });

    it("never wipes notes a custom profile editor cannot read, even holding the notes key", async () => {
      const captured: Captured = {};
      const me = staffMeFixture(
        [],
        [
          "hotels.hotel_profiles_client_fields.update:all",
          "hotels.hotel_internal_rating_notes.update:all",
        ],
      );
      let askedMe = false;
      const fetch: FetchFn = (input, init) => {
        if (String(input).endsWith("/me")) askedMe = true;
        return editorFetch(captured, me)(input, init);
      };
      await renderWithApi(
        <HotelProfileEditSheet open hotel={withoutNotes()} onClose={noop} />,
        fetch,
      );
      await waitFor(() => expect(askedMe).toBe(true));
      await saveRoomsChange();
      expect(screen.queryByTestId("hotel-internal")).toBeNull();
      expect(captured.updated).not.toHaveProperty("internalNotes");
      expect(captured.updated).not.toHaveProperty("internalRating");
    });
  });
});
