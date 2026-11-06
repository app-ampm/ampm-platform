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

function MobileNumber() {
  const [value, setValue] = useState("98765 43210");
  return (
    <Input
      label="Mobile number"
      prefix="+91"
      keyboardType="phone-pad"
      autoComplete="tel-national"
      value={value}
      onChangeText={setValue}
      helpText="The number AMPM has on file"
    />
  );
}

function Notes() {
  const [value, setValue] = useState(
    "Three functions over a long weekend. We'd love a lakeside venue for the sangeet.",
  );
  return (
    <Input label="Anything else we should know?" multiline value={value} onChangeText={setValue} />
  );
}

export const stories = defineStories({
  title: "Input",
  stories: [
    {
      name: "Default with help",
      description: "Focus it: the stroke turns gold and the halo shows on the web.",
      render: () => <Controlled />,
    },
    {
      name: "Prefix: mobile number",
      description: "+91 in pearl 60% with a divider (DS Components, D1, W6).",
      render: () => <MobileNumber />,
    },
    {
      name: "Error: gold, keeps the value",
      render: () => (
        <Input
          label="Mobile number"
          prefix="+91"
          errorText="Enter the 10-digit mobile number"
          defaultValue="98765"
          keyboardType="phone-pad"
        />
      ),
    },
    {
      name: "Disabled",
      render: () => <Input label="Reference" disabled defaultValue="AMPM-2027-0142" />,
    },
    { name: "Multiline: radius 22", render: () => <Notes /> },
    {
      name: "Icons, required and large",
      render: () => (
        <Stack gap={3}>
          <Input
            label="Email"
            required
            leadingIcon="mail"
            placeholder="name@email.com"
            keyboardType="email-address"
          />
          <Input label="Search hotels" size="lg" placeholder="Udaipur" leadingIcon="search" />
        </Stack>
      ),
    },
  ],
});
