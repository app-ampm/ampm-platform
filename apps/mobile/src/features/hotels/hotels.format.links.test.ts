/*
 * The Overview's external-link helpers (B13 / B14 / CP-05): hotelMapUrl (map / street-view link-out),
 * externalHttpUrl (the http(s) scheme guard for the hotel website), and the hotelSections predicate they
 * drive. Split out of hotels.format.test.ts to keep each test file under the 300-line cap (code.md).
 */
import { externalHttpUrl, hotelMapUrl, hotelSections } from "./hotels.format";
import { detailFixture, hotelFixture } from "./hotels.test-utils";

describe("hotelMapUrl", () => {
  const MAPS = "https://www.google.com/maps/search/?api=1&query=";

  it("opens a street-view reference that is already a URL as given", () => {
    expect(hotelMapUrl(hotelFixture({ streetViewRef: "https://maps.app.goo.gl/abc" }))).toBe(
      "https://maps.app.goo.gl/abc",
    );
  });

  it("searches a reference that is not a URL — a place id, plus code or lat,lng", () => {
    expect(hotelMapUrl(hotelFixture({ streetViewRef: "24.5760,73.6833" }))).toBe(
      `${MAPS}${encodeURIComponent("24.5760,73.6833")}`,
    );
  });

  it("falls back to the hotel's name and address when there is no reference", () => {
    expect(hotelMapUrl(hotelFixture({ streetViewRef: null }))).toBe(
      `${MAPS}${encodeURIComponent("The Lake Pavilion, Lake Road, Udaipur")}`,
    );
  });

  it("has nothing to map to without a reference or an address", () => {
    expect(hotelMapUrl(hotelFixture({ streetViewRef: null, address: null }))).toBeNull();
    expect(hotelMapUrl(hotelFixture({ streetViewRef: "   ", address: null }))).toBeNull();
  });
});

describe("externalHttpUrl", () => {
  it("passes an http or https URL through, trimmed", () => {
    expect(externalHttpUrl("https://hotel.example")).toBe("https://hotel.example");
    expect(externalHttpUrl("HTTP://hotel.example")).toBe("HTTP://hotel.example");
    expect(externalHttpUrl("  https://hotel.example  ")).toBe("https://hotel.example");
  });

  it("drops a dangerous or non-http scheme, and blank or null", () => {
    expect(externalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(externalHttpUrl("data:text/html,<script>")).toBeNull();
    expect(externalHttpUrl("tel:+911234567890")).toBeNull();
    expect(externalHttpUrl("evilapp://open")).toBeNull();
    expect(externalHttpUrl("www.hotel.example")).toBeNull();
    expect(externalHttpUrl("   ")).toBeNull();
    expect(externalHttpUrl(null)).toBeNull();
  });
});

describe("hotelSections overview from links", () => {
  it("offers the overview for an http website or a mappable location alone", () => {
    expect(
      hotelSections(
        detailFixture({ description: null, address: null, website: "https://pavilion.example" }),
      ).map((s) => s.value),
    ).toEqual(["overview", "rates"]);
    expect(
      hotelSections(
        detailFixture({ description: null, address: null, streetViewRef: "24.5,73.6" }),
      ).map((s) => s.value),
    ).toEqual(["overview", "rates"]);
  });

  it("hides the overview when the website or reference cannot be shown", () => {
    expect(
      hotelSections(
        detailFixture({ description: null, address: null, website: "javascript:alert(1)" }),
      ).map((s) => s.value),
    ).toEqual(["rates"]);
    expect(
      hotelSections(detailFixture({ description: null, address: null, streetViewRef: "   " })).map(
        (s) => s.value,
      ),
    ).toEqual(["rates"]);
  });
});
