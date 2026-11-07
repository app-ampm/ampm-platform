import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Checkbox, type CheckboxProps } from "./checkbox";

type DemoProps = Omit<CheckboxProps, "checked" | "onCheckedChange"> & {
  readonly initial?: boolean;
};

function Demo({ initial = false, ...props }: DemoProps) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox checked={checked} onCheckedChange={setChecked} {...props} />;
}

export const stories = defineStories({
  title: "Checkbox",
  stories: [
    {
      name: "Ticked and not",
      description: "The consent boxes of the contact form (W6).",
      render: () => (
        <Stack gap={0}>
          <Demo label="I'd like a demo of hotel discovery" initial />
          <Demo label="Send me occasional news from AMPM" />
        </Stack>
      ),
    },
    {
      name: "With a description",
      render: () => (
        <Demo label="Sangeet stage riser checked" description="Due before 18:00 · Rohan" initial />
      ),
    },
    {
      name: "Long label",
      description: "The box stays on the first line.",
      render: () => (
        <Demo label="I've read the privacy notice. Asked once, on your first sign-in." initial />
      ),
    },
    {
      name: "Error: gold",
      render: () => (
        <Demo label="I've read the privacy notice" errorText="Tick the privacy notice to go on" />
      ),
    },
    {
      name: "Disabled",
      render: () => (
        <Stack gap={0}>
          <Demo label="Mehendi" initial disabled />
          <Demo label="Haldi" disabled />
        </Stack>
      ),
    },
  ],
});
