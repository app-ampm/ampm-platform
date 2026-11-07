"use client";

import { useState, type ReactNode } from "react";

import {
  DESTINATIONS_COPY,
  inRegion,
  type Region,
  type RegionFilter as RegionFilterValue,
} from "./destinations-content";
import { DESTINATIONS_HEADING_ID } from "./destinations-ids";
import { RegionFilter } from "./region-filter";

/** A card the server rendered, with the region the filter sorts it by. */
export interface RegionCard {
  readonly key: string;
  readonly region: Region;
  readonly card: ReactNode;
}

export interface DestinationsBrowserProps {
  /** The page's eyebrow and heading (h1 with DESTINATIONS_HEADING_ID), beside the filter on a desktop. */
  readonly intro: ReactNode;
  readonly cards: readonly RegionCard[];
}

/**
 * The opening of the destinations page (W4): the heading with the region pills, and the grid they
 * filter (one column on a phone, two on a tablet, three on a desktop). Only the filter's state lives
 * on the client; the cards come rendered from the server. A hidden status line reads out how many
 * destinations the filter left.
 */
export function DestinationsBrowser({ intro, cards }: DestinationsBrowserProps) {
  const [filter, setFilter] = useState<RegionFilterValue>("all");
  const shown = inRegion(cards, filter);
  return (
    <section aria-labelledby={DESTINATIONS_HEADING_ID} className="flex flex-col gap-8 md:gap-14">
      <div className="flex flex-col gap-6 md:gap-8 xl:flex-row xl:items-end xl:justify-between">
        {intro}
        <RegionFilter value={filter} onChange={setFilter} className="xl:self-end" />
      </div>
      <p role="status" className="sr-only">
        {DESTINATIONS_COPY.shown(shown.length, filter)}
      </p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {shown.map(({ key, card }) => (
          <li key={key}>{card}</li>
        ))}
      </ul>
    </section>
  );
}
