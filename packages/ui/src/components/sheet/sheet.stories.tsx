import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Input } from "../input";
import { Row, Stack } from "../layout";
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
          <Text>The hotel team checks with the property and records the answer here.</Text>
          <Input label="Dates" placeholder="14 to 16 February 2027" />
          <Input label="Rooms" placeholder="40" keyboardType="number-pad" />
        </Stack>
      </Sheet>
    </>
  );
}

/** P8's decision sheet: one gold action, a secondary beside it, the context above. */
function DecisionSheetDemo() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)}>
        Open decision sheet
      </Button>
      <Sheet
        open={open}
        onClose={close}
        title="Sangeet décor, version 3"
        footer={
          <>
            <Button fullWidth size="lg" onPress={close}>
              Approve version 3
            </Button>
            <Button fullWidth variant="secondary" onPress={close}>
              Request a revision
            </Button>
          </>
        }
      >
        <Row justify="between">
          <Text variant="bodySmall">One representative decides</Text>
          <Text variant="bodySmall">Respond by 13 Nov</Text>
        </Row>
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
    { name: "Decision sheet", render: () => <DecisionSheetDemo /> },
  ],
});
