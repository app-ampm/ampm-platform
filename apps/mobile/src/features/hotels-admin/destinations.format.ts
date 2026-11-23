import type { DestinationListItemView, DestinationView } from "@ampm/core";

import { hotelStatusLabel } from "./hotels-admin.format";

/* Presentation helpers for the Destinations screen (TW-20). No fetching, no rules. */

/**
 * Where a destination is, as one line: its region, state and country, skipping blanks.
 *
 * @example
 * destinationPlace({ region: "Mewar", state: "Rajasthan", country: "India" }); // "Mewar, Rajasthan, India"
 */
export function destinationPlace(
  destination: Pick<DestinationView, "region" | "state" | "country">,
): string {
  return [destination.region, destination.state, destination.country]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(", ");
}

/** How many hotels are filed under a destination, in words: "No hotels", "1 hotel", "12 hotels". */
export function hotelCountLabel(count: number): string {
  if (count === 0) return "No hotels";
  return `${count} ${count === 1 ? "hotel" : "hotels"}`;
}

/** A screen-reader summary of one destination row: name, place, status, hotels. */
export function destinationRowSummary(destination: DestinationListItemView): string {
  return [
    destination.name,
    destinationPlace(destination),
    hotelStatusLabel(destination.status).toLowerCase(),
    hotelCountLabel(destination.hotelCount),
  ]
    .filter((part) => part !== "")
    .join(", ");
}
