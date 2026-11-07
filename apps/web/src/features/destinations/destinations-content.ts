/*
 * The destinations page's content (PUB-04), copied from the approved mock's data script and the W4
 * artboard (`Peacock Night 1 - Website.dc.html`). Photos are placeholders until the media library
 * supplies them; the words are the mock's. The featured destination's hotels are the mock's sample
 * names: AMPM replaces them with the hotels it works with there before the site launches.
 */

/** The regions the filter offers, in the mock's order (W4). */
export const REGIONS = ["Rajasthan", "West coast", "South", "Himalayas"] as const;
export type Region = (typeof REGIONS)[number];

/** The filter's value: every destination, or one region's. */
export type RegionFilter = "all" | Region;

export interface Destination {
  readonly name: string;
  readonly region: Region;
  /** One line on what the place gives a wedding. */
  readonly note: string;
}

/** Where AMPM plans, in the mock's order: the home page shows the first six. */
export const DESTINATIONS: readonly Destination[] = [
  { name: "Udaipur", region: "Rajasthan", note: "Lakes, palaces and ghats" },
  { name: "Jaipur", region: "Rajasthan", note: "Forts and painted courtyards" },
  { name: "Jodhpur", region: "Rajasthan", note: "Mehrangarh and the blue city" },
  { name: "Goa", region: "West coast", note: "Beaches and Portuguese villas" },
  { name: "Kerala", region: "South", note: "Backwaters and coconut groves" },
  { name: "Mussoorie", region: "Himalayas", note: "Cedar forests above the valley" },
  { name: "Jaisalmer", region: "Rajasthan", note: "Dunes and desert camps" },
  { name: "Coorg", region: "South", note: "Coffee estates in the hills" },
  { name: "Rishikesh", region: "Himalayas", note: "The Ganga at the foothills" },
];

/**
 * The items a filter keeps, in their order: all of them, or those in the chosen region.
 *
 *   inRegion(DESTINATIONS, "South") // Kerala, Coorg
 */
export function inRegion<T extends { readonly region: Region }>(
  items: readonly T[],
  filter: RegionFilter,
): readonly T[] {
  return filter === "all" ? items : items.filter((item) => item.region === filter);
}

/** The featured destination under the grid (W4). */
export const FEATURED_DESTINATION = {
  name: "Udaipur",
  photo: "Udaipur · City Palace at dusk",
  description:
    "Lake palaces, ghats and courtyards that hold three hundred guests. Most of our Udaipur weddings run over three days.",
  hotelsLabel: "Hotels we work with here",
  hotels: ["Raj Niwas Palace", "Aravalli Lake Resort", "Haveli Sarovar"],
  note: "Rates, rooms and venues are inside hotel discovery.",
  action: "Plan Udaipur with AMPM",
} as const;

export const DESTINATIONS_COPY = {
  eyebrow: "Destinations",
  title: "Where",
  emphasis: "we plan.",
  filterLabel: "Filter destinations by region",
  all: "All",
  photo: (name: string) => `Destination photo · ${name}`,
  featuredEyebrow: "Featured destination",
  /** Read out when the filter changes; the grid itself says nothing on its own. */
  shown: (count: number, filter: RegionFilter) =>
    `${count} ${count === 1 ? "destination" : "destinations"}${filter === "all" ? "" : ` in ${filter}`}`,
} as const;
