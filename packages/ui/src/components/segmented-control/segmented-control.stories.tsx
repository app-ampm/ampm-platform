import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "../text";
import { SegmentedControl, type SegmentedControlProps } from "./segmented-control";

type DemoProps = Omit<SegmentedControlProps, "value" | "onChange"> & { readonly initial: string };

function Demo({ initial, ...props }: DemoProps) {
  const [value, setValue] = useState(initial);
  return <SegmentedControl value={value} onChange={setValue} {...props} />;
}

const HOTEL_SECTIONS = [
  { value: "overview", label: "Overview" },
  { value: "rooms", label: "Rooms" },
  { value: "venues", label: "Venues" },
  { value: "rates", label: "Rates" },
  { value: "menus", label: "Menus" },
  { value: "location", label: "Location" },
] as const;

export const stories = defineStories({
  title: "SegmentedControl",
  stories: [
    {
      name: "Tabs",
      description: "The selected segment is a peacock pill with a midnight label (DS Components).",
      render: () => (
        <Demo
          accessibilityLabel="Hotel sections"
          options={HOTEL_SECTIONS.slice(0, 4)}
          initial="overview"
        />
      ),
    },
    {
      name: "Underline tabs",
      description: "A record's sections over a sliding gold line, no track (T3, T5).",
      render: () => (
        <Demo
          accessibilityLabel="Hotel record"
          variant="underline"
          options={HOTEL_SECTIONS.slice(0, 4)}
          initial="rates"
        />
      ),
    },
    {
      name: "Full width with counts",
      description: "Waiting · 4 / Decided · 11 (P7) and the enquiry or demo switch (W6).",
      render: () => (
        <Stack gap={3}>
          <Demo
            accessibilityLabel="Approvals"
            fullWidth
            options={[
              { value: "waiting", label: "Waiting", badge: 4 },
              { value: "decided", label: "Decided", badge: 11 },
            ]}
            initial="waiting"
          />
          <Demo
            accessibilityLabel="Request type"
            fullWidth
            options={[
              { value: "enquiry", label: "Send an enquiry" },
              { value: "demo", label: "Request a demo" },
            ]}
            initial="demo"
          />
        </Stack>
      ),
    },
    {
      name: "Scrollable strip",
      description: "The hotel page tabs: scroll sideways; the selected tab stays centred.",
      render: () => (
        <Demo
          accessibilityLabel="Hotel sections"
          scrollable
          options={HOTEL_SECTIONS}
          initial="rates"
        />
      ),
    },
    {
      name: "Small, with a disabled segment",
      render: () => (
        <Stack gap={2}>
          <Demo
            accessibilityLabel="Season"
            size="sm"
            options={[
              { value: "winter", label: "Winter 2026–27" },
              { value: "summer", label: "Summer 2027" },
              { value: "monsoon", label: "Monsoon 2027", disabled: true },
            ]}
            initial="winter"
          />
          <Text variant="caption" tone="muted">
            Monsoon rates are not published yet.
          </Text>
        </Stack>
      ),
    },
  ],
});
