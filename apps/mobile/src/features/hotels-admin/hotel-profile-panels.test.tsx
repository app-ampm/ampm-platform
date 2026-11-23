import { fireEvent, screen, waitFor, within } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { profileEditorFetch, type CapturedSave } from "./hotel-profile.test-utils";
import { hotelStaffViewFixture, renderWithApi } from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const noop = (): void => {};

/** Saves the open sheet and waits for the update to land. */
async function save(): Promise<void> {
  await fireEvent.press(screen.getByTestId("hotel-profile-submit"));
  expect(await screen.findByText("Hotel updated")).toBeOnTheScreen();
}

describe("the profile editor's D-178 panels", () => {
  describe("location and access", () => {
    it("seeds the hotel's place and sends only what staff change, coordinates included", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({ city: "Udaipur", airportDistanceKm: 22.5 });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      const location = await screen.findByTestId("hotel-location");
      expect(within(location).getByTestId("hotel-city")).toHaveDisplayValue("Udaipur");
      expect(within(location).getByTestId("hotel-airport-km")).toHaveDisplayValue("22.5");
      await fireEvent.changeText(
        screen.getByTestId("hotel-maps-url"),
        "https://maps.app.goo.gl/SyntheticPin1",
      );
      await fireEvent.changeText(screen.getByTestId("hotel-latitude"), "12.345678");
      await fireEvent.changeText(screen.getByTestId("hotel-longitude"), "76.54321");
      await fireEvent.changeText(screen.getByTestId("hotel-railway-minutes"), "25");
      await save();
      expect(captured.updated).toEqual({
        mapsUrl: "https://maps.app.goo.gl/SyntheticPin1",
        latitude: 12.345678,
        longitude: 76.54321,
        railwayDriveMinutes: 25,
      });
    });
  });

  describe("food and beverage", () => {
    it("starts every fact at Not known, and sends only the answer staff give", async () => {
      const captured: CapturedSave = {};
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
        profileEditorFetch(captured),
      );
      expect(await screen.findByTestId("hotel-pure-veg-unknown")).toBeChecked();
      expect(screen.getByTestId("hotel-veg-kitchen-unknown")).toBeChecked();
      expect(screen.getByTestId("hotel-alcohol-unknown")).toBeChecked();
      await fireEvent.press(screen.getByTestId("hotel-alcohol-yes"));
      expect(screen.getByTestId("hotel-alcohol-yes")).toBeChecked();
      await save();
      expect(captured.updated).toEqual({ servesAlcohol: true });
    });

    it("takes a known answer back to Not known, as null, never false", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({ isPureVegetarian: false, servesAlcohol: true });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      expect(await screen.findByTestId("hotel-pure-veg-no")).toBeChecked();
      await fireEvent.press(screen.getByTestId("hotel-alcohol-unknown"));
      await save();
      expect(captured.updated).toEqual({ servesAlcohol: null });
    });

    it("offers the configured cuisines and Other, keeping a label the options no longer list", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({ cuisines: ["Coastal"] });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      expect(await screen.findByTestId("hotel-cuisine-indian")).not.toBeSelected();
      expect(screen.getByTestId("hotel-cuisine-coastal")).toBeSelected();
      await fireEvent.press(screen.getByTestId("hotel-cuisine-asian"));
      await fireEvent.press(screen.getByTestId("hotel-cuisine-other"));
      expect(screen.getByTestId("hotel-cuisine-asian")).toBeSelected();
      await save();
      // A cuisine-only save sends the cuisines alone.
      expect(captured.updated).toEqual({ cuisines: ["Coastal", "Asian", "Other"] });
    });

    it("lets staff remove an unlisted label and take the removal back", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({ cuisines: ["Coastal", "Indian"] });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      const coastal = await screen.findByTestId("hotel-cuisine-coastal");
      await fireEvent.press(coastal);
      expect(screen.getByTestId("hotel-cuisine-coastal")).not.toBeSelected();
      await fireEvent.press(screen.getByTestId("hotel-cuisine-coastal"));
      expect(screen.getByTestId("hotel-cuisine-coastal")).toBeSelected();
      await fireEvent.press(screen.getByTestId("hotel-cuisine-coastal"));
      await save();
      expect(captured.updated).toMatchObject({ cuisines: ["Indian"] });
    });

    it("keeps the hotel's labels on screen when the cuisine list fails, and retries it", async () => {
      let calls = 0;
      const base = profileEditorFetch({});
      const fetch: typeof base = (input, init) => {
        if (String(input).endsWith("/hotels-admin/cuisine-options")) {
          calls += 1;
          if (calls === 1) return Promise.resolve(new Response("{}", { status: 500 }));
        }
        return base(input, init);
      };
      const hotel = hotelStaffViewFixture({ cuisines: ["Coastal"] });
      await renderWithApi(<HotelProfileEditSheet open hotel={hotel} onClose={noop} />, fetch);
      await fireEvent.press(await screen.findByTestId("hotel-cuisines-retry"));
      expect(screen.getByTestId("hotel-cuisine-coastal")).toBeSelected();
      expect(await screen.findByTestId("hotel-cuisine-indian")).toBeOnTheScreen();
    });
  });

  describe("booking terms", () => {
    it("shows them to a profile editor who may not touch the internal notes, and saves them", async () => {
      const captured: CapturedSave = {};
      const me = staffMeFixture([], ["hotels.hotel_profiles_client_fields.update:all"]);
      let askedMe = false;
      const base = profileEditorFetch(captured, { me });
      const fetch: typeof base = (input, init) => {
        if (String(input).endsWith("/me")) askedMe = true;
        return base(input, init);
      };
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
        fetch,
      );
      await waitFor(() => expect(askedMe).toBe(true));
      const terms = await screen.findByTestId("hotel-booking-terms");
      expect(within(terms).getByText("Booking terms · seen only by AMPM")).toBeOnTheScreen();
      expect(screen.queryByTestId("hotel-internal")).toBeNull();
      expect(screen.getByTestId("hotel-buyout-unset")).toBeChecked();
      await fireEvent.press(screen.getByTestId("hotel-buyout-required"));
      await fireEvent.changeText(screen.getByTestId("hotel-min-nights"), "2");
      await fireEvent.press(screen.getByTestId("hotel-parallel-not_allowed"));
      await save();
      expect(captured.updated).toEqual({
        weddingBuyoutPolicy: "required",
        minNights: 2,
        parallelFunctions: "not_allowed",
      });
    });

    it("sends Not set as null", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({ weddingBuyoutPolicy: "depends" });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      expect(await screen.findByTestId("hotel-buyout-depends")).toBeChecked();
      await fireEvent.press(screen.getByTestId("hotel-buyout-unset"));
      await save();
      expect(captured.updated).toMatchObject({ weddingBuyoutPolicy: null });
    });
  });

  describe("identity and details", () => {
    it("seeds the name variants one per line and the event space, sending only what changes", async () => {
      const captured: CapturedSave = {};
      const hotel = hotelStaffViewFixture({
        parentGroup: "Synthetic Group",
        nameAliases: ["The Lakeside", "Lakeside Palace Hotel"],
        totalEventSpaceSqft: 12917,
      });
      await renderWithApi(
        <HotelProfileEditSheet open hotel={hotel} onClose={noop} />,
        profileEditorFetch(captured),
      );
      expect(await screen.findByTestId("hotel-name-variants")).toHaveDisplayValue(
        "The Lakeside\nLakeside Palace Hotel",
      );
      await fireEvent.changeText(screen.getByTestId("hotel-event-space-sqm"), "1200");
      await save();
      // The INTERNAL values the sheet seeded are left out while unchanged, so a save cannot wipe them.
      expect(captured.updated).toEqual({ totalEventSpaceSqm: 1200 });
    });
  });
});
