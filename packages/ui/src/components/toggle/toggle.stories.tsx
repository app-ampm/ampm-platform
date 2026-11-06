import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Toggle, type ToggleProps } from "./toggle";

type DemoProps = Omit<ToggleProps, "value" | "onValueChange"> & { readonly initial?: boolean };

function Demo({ initial = false, ...props }: DemoProps) {
  const [value, setValue] = useState(initial);
  return <Toggle value={value} onValueChange={setValue} {...props} />;
}

export const stories = defineStories({
  title: "Toggle",
  stories: [
    {
      name: "On and off",
      description: "Press the row: the knob slides (it jumps under reduced motion).",
      render: () => (
        <Stack gap={1}>
          <Demo label="Remember this device" initial />
          <Demo label="Airport pickup for all 4" />
        </Stack>
      ),
    },
    {
      name: "With a description",
      render: () => (
        <Demo
          label="Collect identity documents"
          description="Off by default. Aadhaar is never accepted."
        />
      ),
    },
    {
      name: "Disabled",
      render: () => (
        <Stack gap={1}>
          <Demo label="Remember this device" initial disabled />
          <Demo label="Show on the website" disabled />
        </Stack>
      ),
    },
    {
      name: "Switch only",
      description: "In a table cell, with an accessibility label instead of a visible one.",
      render: () => <Demo accessibilityLabel="Show to clients" initial className="self-start" />,
    },
  ],
});
