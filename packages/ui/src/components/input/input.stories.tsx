import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Input } from "./input";

function Controlled() {
  const [value, setValue] = useState("");
  return (
    <Input
      label="Guest name"
      placeholder="Priya Sharma"
      value={value}
      onChangeText={setValue}
      helpText="As on the invitation"
    />
  );
}

export const stories = defineStories({
  title: "Input",
  stories: [
    { name: "Default with help", render: () => <Controlled /> },
    {
      name: "States",
      render: () => (
        <Stack gap={3}>
          <Input
            label="Email"
            required
            leadingIcon="mail"
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Input
            label="Phone"
            errorText="Enter a 10-digit mobile number"
            defaultValue="98765"
            keyboardType="phone-pad"
          />
          <Input label="Reference" disabled defaultValue="AMPM-2027-0142" />
          <Input label="Large" size="lg" placeholder="Search hotels" leadingIcon="search" />
        </Stack>
      ),
    },
  ],
});
