import type { HotelVenueClientView, MediaGalleryItem, MediaVideoItem } from "@ampm/core";

import {
  desktopFacts,
  desktopSections,
  hasHotelLocation,
  mediaCountLabel,
  venueSeatLines,
} from "./hotels.format.desktop";
import { detailFixture, summaryFixture } from "./hotels.test-utils";

const VENUE: HotelVenueClientView = {
  id: "018f0000-0000-7000-8000-000000000a01",
  name: "The Durbar Ballroom",
  venueType: "ballroom",
  isIndoor: true,
  areaSqm: 1200,
  capacityBanquet: 500,
  capacityTheatre: null,
  capacityReception: 900,
  facilities: null,
  description: null,
};

const image = (id: string): MediaGalleryItem => ({
  id,
  kind: "image",
  caption: null,
  thumbnailUrl: "https://media.test/thumb.jpg",
  webUrl: "https://media.test/web.jpg",
});

const video = (id: string): MediaVideoItem => ({ id, caption: null, url: "/media/blob?key=v" });

describe("desktop hotel page helpers (D6)", () => {
  it("keeps the rates out of the tabs and opens on an overview of what the hotel has", () => {
    const hotel = detailFixture({ venues: [VENUE], gallery: [image("1")] });
    expect(desktopSections(hotel).map((section) => section.value)).toEqual([
      "overview",
      "venues",
      "gallery",
    ]);
  });

  it("drops the overview when there is nothing for the main column to show at a glance", () => {
    const hotel = detailFixture({ description: null, videos: [video("1")] });
    expect(desktopSections(hotel).map((section) => section.value)).toEqual(["video"]);
    expect(desktopSections(detailFixture({ description: null }))).toEqual([]);
  });

  it("counts the photos and videos for the mosaic's pill", () => {
    expect(mediaCountLabel(detailFixture())).toBeNull();
    expect(mediaCountLabel(detailFixture({ gallery: [image("1")] }))).toBe("1 photo");
    expect(
      mediaCountLabel(detailFixture({ gallery: [image("1"), image("2")], videos: [video("1")] })),
    ).toBe("All 2 photos · 1 video");
  });

  it("adds the venue count and seating range to the facts, only when known", () => {
    expect(desktopFacts(detailFixture({ venues: [VENUE] }))).toEqual(["1 venue", "Seats 500–900"]);
    expect(desktopFacts(detailFixture({ summary: summaryFixture({ capacity: null }) }))).toEqual(
      [],
    );
  });

  it("lists a venue's known seatings one per line", () => {
    expect(venueSeatLines(VENUE)).toEqual(["Banquet 500", "Reception 900"]);
  });

  it("knows whether there is a location to show", () => {
    expect(hasHotelLocation(detailFixture())).toBe(true);
    expect(hasHotelLocation(detailFixture({ address: null }))).toBe(false);
    expect(hasHotelLocation(detailFixture({ address: null, website: "https://x.example" }))).toBe(
      true,
    );
  });
});
