import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Stack } from "../layout";
import { ConfirmSheet } from "./confirm-sheet";

function Interactive({ destructive }: { readonly destructive: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Stack gap={2}>
      <Button variant={destructive ? "destructive" : "highlight"} onPress={() => setOpen(true)}>
        {destructive ? "Close lead" : "Confirm step"}
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={destructive ? "Close this lead?" : "Confirm this step?"}
        description={
          destructive
            ? "The lead becomes read-only. You can still see it in the pipeline."
            : "This goes ahead once you confirm."
        }
        confirmLabel={destructive ? "Close lead" : "Confirm"}
        destructive={destructive}
        onConfirm={() => setOpen(false)}
      />
    </Stack>
  );
}

export const stories = defineStories({
  title: "Confirm sheet",
  stories: [
    { name: "Positive", render: () => <Interactive destructive={false} /> },
    { name: "Destructive", render: () => <Interactive destructive /> },
  ],
});
