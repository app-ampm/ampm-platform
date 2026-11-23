import { locationBody, locationDraftFrom, validateLocation } from "./hotel-location.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

const empty = locationDraftFrom(null);

describe("hotel-location.form", () => {
  it("starts a create draft empty and seeds an edit draft from the hotel", () => {
    expect(Object.values(empty).every((value) => value === "")).toBe(true);
    const draft = locationDraftFrom(
      hotelStaffViewFixture({
        address: "1 Synthetic Road",
        railwayStationName: "Synthetic Junction",
        railwayDistanceKm: 4.5,
        cityCentreDriveMinutes: 15,
      }),
    );
    expect(draft).toMatchObject({
      address: "1 Synthetic Road",
      railwayStationName: "Synthetic Junction",
      railwayDistanceKm: "4.5",
      cityCentreDriveMinutes: "15",
    });
  });

  describe("validateLocation", () => {
    it("passes an empty draft: every location field is optional", () => {
      const errors = validateLocation(empty, "India");
      expect(Object.values(errors).every((error) => error === undefined)).toBe(true);
    });

    it("takes https Google Maps links and refuses anything else", () => {
      for (const link of [
        "https://maps.app.goo.gl/SyntheticPin1",
        "https://www.google.com/maps/place/Synthetic+Lake+Hotel",
        "https://maps.google.co.in/?q=12.3,76.5",
      ]) {
        expect(validateLocation({ ...empty, mapsUrl: link }, null).mapsUrl).toBeUndefined();
      }
      for (const link of [
        "http://maps.app.goo.gl/SyntheticPin1",
        "https://example.com/maps",
        "https://www.google.com/url?q=https://example.com",
        "maps.app.goo.gl/SyntheticPin1",
      ]) {
        expect(validateLocation({ ...empty, mapsUrl: link }, null).mapsUrl).toBe(
          "Use an https Google Maps link (google.com/maps or maps.app.goo.gl)",
        );
      }
    });

    it("checks coordinates as signed decimals within range, up to six places", () => {
      const at = (latitude: string, longitude: string) =>
        validateLocation({ ...empty, latitude, longitude }, null);
      expect(at("12.345678", "-76.54321")).toMatchObject({
        latitude: undefined,
        longitude: undefined,
      });
      expect(at("91", "181").latitude).toBe(
        "Latitude is a number from -90 to 90, with up to 6 decimals",
      );
      expect(at("91", "181").longitude).toBe(
        "Longitude is a number from -180 to 180, with up to 6 decimals",
      );
      expect(at("12.3456789", "0").latitude).toBeDefined();
    });

    it("checks distances in km to one decimal and drives in whole minutes", () => {
      const errors = validateLocation(
        {
          ...empty,
          airportDistanceKm: "22.55",
          airportDriveMinutes: "601",
          railwayDistanceKm: "1000",
          railwayDriveMinutes: "12.5",
          cityCentreDistanceKm: "3.5",
          cityCentreDriveMinutes: "10",
        },
        null,
      );
      expect(errors).toMatchObject({
        airportDistanceKm: "Airport distance is in km, from 0 to 999.9, with one decimal at most",
        airportDriveMinutes: "Airport drive is whole minutes, from 0 to 600",
        railwayDistanceKm:
          "Railway station distance is in km, from 0 to 999.9, with one decimal at most",
        railwayDriveMinutes: "Railway station drive is whole minutes, from 0 to 600",
        cityCentreDistanceKm: undefined,
        cityCentreDriveMinutes: undefined,
      });
    });

    it("checks an Indian PIN only when the destination's country is known", () => {
      expect(validateLocation({ ...empty, postalCode: "12345" }, "India").postalCode).toBe(
        "A PIN code is 6 digits and does not start with 0",
      );
      expect(
        validateLocation({ ...empty, postalCode: "SW1A 1AA" }, "United Kingdom").postalCode,
      ).toBe(undefined);
      expect(validateLocation({ ...empty, postalCode: "12345" }, null).postalCode).toBeUndefined();
      expect(validateLocation({ ...empty, postalCode: "1".repeat(17) }, null).postalCode).toBe(
        "A PIN code is at most 16 characters",
      );
    });
  });

  it("builds the body: trimmed text or null, parsed numbers", () => {
    expect(
      locationBody({
        ...empty,
        city: "  Udaipur ",
        postalCode: " 313001 ",
        latitude: "12.345678",
        airportDistanceKm: "22.5",
        airportDriveMinutes: "40",
      }),
    ).toEqual({
      address: null,
      locality: null,
      city: "Udaipur",
      state: null,
      postalCode: "313001",
      mapsUrl: null,
      latitude: 12.345678,
      longitude: null,
      airportName: null,
      airportDistanceKm: 22.5,
      airportDriveMinutes: 40,
      railwayStationName: null,
      railwayDistanceKm: null,
      railwayDriveMinutes: null,
      cityCentreDistanceKm: null,
      cityCentreDriveMinutes: null,
      accessNotes: null,
    });
  });
});
