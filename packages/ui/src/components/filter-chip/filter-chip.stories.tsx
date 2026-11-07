import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Row } from "../layout";
import { FilterChip } from "./filter-chip";

const FILTERS = ["Verified rates", "Lake view", "Palace", "Outdoor venue", "300+"] as const;

/** A row the reader can toggle, as on the search screens (the screen owns the selection). */
function ToggleRow() {
  const [on, setOn] = useState<ReadonlySet<string>>(new Set(["Verified rates", "Lake view"]));
  const toggle = (label: string) =>
    setOn((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  return (
    <Row gap={2} wrap>
      {FILTERS.map((label) => (
        <FilterChip
          key={label}
          label={label}
          selected={on.has(label)}
          onPress={() => toggle(label)}
        />
      ))}
    </Row>
  );
}

export const stories = defineStories({
  title: "FilterChip",
  stories: [
    {
      name: "Search filters",
      description: "Pearl 30% outline; selected is peacock with a midnight label. Tap to toggle.",
      render: () => <ToggleRow />,
    },
    {
      name: "States",
      render: () => (
        <Row gap={2} wrap>
          <FilterChip label="Heritage" />
          <FilterChip label="Heritage" selected />
          <FilterChip label="Separate veg kitchen" disabled />
          <FilterChip label="Lake view" selected disabled />
        </Row>
      ),
    },
    {
      name: "Icons and counts",
      render: () => (
        <Row gap={2} wrap>
          <FilterChip label="Filters" icon="sliders" count={2} />
          <FilterChip label="Palace" icon="castle" selected />
          <FilterChip label="Lake view" icon="map-pin" count={6} />
        </Row>
      ),
    },
  ],
});
