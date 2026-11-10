import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Select, type SelectOption } from "./select";

const DESTINATIONS: readonly SelectOption<string>[] = [
  { value: "udaipur", label: "Udaipur, Rajasthan" },
  { value: "jaipur", label: "Jaipur, Rajasthan" },
  { value: "goa", label: "Goa" },
  { value: "kerala", label: "Kochi, Kerala" },
  { value: "shimla", label: "Shimla, Himachal Pradesh" },
];

function Basic() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      label="Destination"
      placeholder="Choose a destination"
      value={value}
      options={DESTINATIONS}
      onChange={setValue}
      helpText="Where the wedding takes place."
    />
  );
}

function Searchable() {
  const [value, setValue] = useState<string | null>("goa");
  return (
    <Select
      label="Destination"
      value={value}
      options={DESTINATIONS}
      onChange={setValue}
      searchable
      sheetTitle="Choose a destination"
    />
  );
}

export const stories = defineStories({
  title: "Select",
  stories: [
    {
      name: "Default with help",
      description: "Tap the field to open the option sheet.",
      render: () => <Basic />,
    },
    {
      name: "Searchable, with a value",
      description: "A search box filters a longer list by label.",
      render: () => <Searchable />,
    },
    {
      name: "Error: gold stroke",
      render: () => (
        <Select
          label="Destination"
          value={null}
          options={DESTINATIONS}
          onChange={() => {}}
          errorText="Choose a destination."
        />
      ),
    },
    {
      name: "Disabled and required",
      render: () => (
        <Stack gap={3}>
          <Select
            label="Destination"
            value="udaipur"
            options={DESTINATIONS}
            onChange={() => {}}
            disabled
          />
          <Select
            label="Destination"
            value={null}
            options={DESTINATIONS}
            onChange={() => {}}
            required
            placeholder="Choose a destination"
          />
        </Stack>
      ),
    },
  ],
});
