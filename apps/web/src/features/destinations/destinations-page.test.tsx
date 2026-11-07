import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DESTINATIONS,
  DESTINATIONS_COPY,
  FEATURED_DESTINATION,
  REGIONS,
  inRegion,
} from "./destinations-content";
import { DestinationsPage } from "./destinations-page";
import { RegionFilter } from "./region-filter";

/** PUB-04 as the server sends it (all regions shown), and the filter that narrows it in the browser. */
describe("destinations page", () => {
  const html = renderToStaticMarkup(<DestinationsPage />);

  it("opens with the heading, the gold words emphasised", () => {
    expect(html).toMatch(/<h1 [^>]*id="destinations-heading"/);
    expect(html).toContain('Where <span class="text-brand">we plan.</span>');
  });

  it("lists the nine destinations of the mock, each with its region and note", () => {
    const names = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
    expect(names).toEqual([...DESTINATIONS.map((destination) => destination.name), "Udaipur"]);
    expect(html).toContain("Mehrangarh and the blue city");
    expect(html).toContain('aria-label="Destination photo · Rishikesh"');
  });

  it("offers every region, with All pressed until one is chosen", () => {
    expect(html).toContain('role="group" aria-label="Filter destinations by region"');
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*><span[^>]*>All<\/span>/);
    for (const region of REGIONS)
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*><span[^>]*>${region}</span>`));
    expect(html).toContain('<p role="status" class="sr-only">9 destinations</p>');
  });

  it("features Udaipur and sends its gold action to the contact page", () => {
    expect(html).toMatch(/<h2 id="featured-destination-heading"[^>]*>Udaipur<\/h2>/);
    expect(html).toMatch(/href="\/contact"[^>]*><span[^>]*>Plan Udaipur with AMPM<\/span>/);
  });

  it("lists the hotels AMPM works with there, between the description and the note", () => {
    expect(html).toContain('<ul aria-labelledby="featured-destination-hotels"');
    expect(html).toContain(
      '<span id="featured-destination-hotels">Hotels we work with here</span>',
    );
    const rows = [
      ...html.matchAll(
        /<li class="[^"]*"><div aria-hidden="true"[^>]*>.*?<\/div><span[^>]*>([^<]+)<\/span><\/li>/g,
      ),
    ];
    expect(rows.map((match) => match[1])).toEqual([...FEATURED_DESTINATION.hotels]);
    const list = html.indexOf("featured-destination-hotels");
    expect(list).toBeGreaterThan(html.indexOf("Most of our Udaipur weddings"));
    expect(list).toBeLessThan(html.indexOf("Rates, rooms and venues are inside hotel discovery."));
  });

  it("shows no prices anywhere (the site never quotes a rate)", () => {
    expect(html).not.toMatch(/₹|INR|lakh/);
  });
});

describe("region filter", () => {
  it("keeps every destination for All and only a region's for a region, in order", () => {
    expect(inRegion(DESTINATIONS, "all")).toHaveLength(9);
    expect(inRegion(DESTINATIONS, "Rajasthan").map((destination) => destination.name)).toEqual([
      "Udaipur",
      "Jaipur",
      "Jodhpur",
      "Jaisalmer",
    ]);
    expect(inRegion(DESTINATIONS, "West coast").map((destination) => destination.name)).toEqual([
      "Goa",
    ]);
  });

  it("gives every region at least one destination", () => {
    for (const region of REGIONS) expect(inRegion(DESTINATIONS, region).length).toBeGreaterThan(0);
  });

  it("marks the chosen region pressed", () => {
    const html = renderToStaticMarkup(<RegionFilter value="South" onChange={() => undefined} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span[^>]*>South<\/span>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*><span[^>]*>All<\/span>/);
  });

  it("reads out how many destinations a filter leaves", () => {
    expect(DESTINATIONS_COPY.shown(2, "South")).toBe("2 destinations in South");
    expect(DESTINATIONS_COPY.shown(1, "West coast")).toBe("1 destination in West coast");
  });
});
