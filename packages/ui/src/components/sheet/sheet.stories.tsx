import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Input } from "../input";
import { Stack } from "../layout";
import { Text } from "../text";
import { Sheet } from "./sheet";

function SheetDemo({ size }: { size: "auto" | "half" | "full" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)}>
        {`Open ${size} sheet`}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Request availability"
        size={size}
        footer={
          <Button fullWidth onPress={() => setOpen(false)}>
            Send request
          </Button>
        }
      >
        <Stack gap={3}>
          <Text tone="muted">
            The hotel team checks with the property and records the answer here.
          </Text>
          <Input label="Dates" placeholder="14 to 16 February 2027" />
          <Input label="Rooms" placeholder="40" keyboardType="number-pad" />
        </Stack>
      </Sheet>
    </>
  );
}

export const stories = defineStories({
  title: "Sheet",
  stories: [
    { name: "Auto height", render: () => <SheetDemo size="auto" /> },
    { name: "Half", render: () => <SheetDemo size="half" /> },
    { name: "Full", render: () => <SheetDemo size="full" /> },
  ],
});
