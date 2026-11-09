import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import type { DateRange } from "./date-range";
import { DateRangeField } from "./date-range-field";

function Basic() {
  const [value, setValue] = useState<DateRange>({});
  return (
    <DateRangeField
      label="Date range"
      value={value}
      onChange={setValue}
      helpText="Pick a preset window or a custom from/to."
    />
  );
}

function Custom() {
  const [value, setValue] = useState<DateRange>({ from: "2026-01-01", to: "2026-03-31" });
  return <DateRangeField label="Date range" value={value} onChange={setValue} />;
}

export const stories = defineStories({
  title: "DateRangeField",
  stories: [
    {
      name: "Default (All time)",
      description: "Tap the field to pick a preset or a custom range.",
      render: () => <Basic />,
    },
    { name: "A custom range", render: () => <Custom /> },
    {
      name: "Disabled",
      render: () => (
        <Stack gap={3}>
          <DateRangeField
            label="Date range"
            value={{ from: "2026-01-01", to: "2026-06-30" }}
            onChange={() => {}}
            disabled
          />
        </Stack>
      ),
    },
  ],
});
