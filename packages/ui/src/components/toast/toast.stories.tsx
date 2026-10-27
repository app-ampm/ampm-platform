import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Row } from "../layout";
import { useToast } from "./toast-provider";
import type { ToastOptions } from "./toast.types";

interface Demo {
  readonly label: string;
  readonly toast: ToastOptions;
}

const DEMOS: readonly Demo[] = [
  { label: "Success", toast: { title: "Saved", tone: "success" } },
  {
    label: "Sticky warning",
    toast: {
      title: "You are offline",
      description: "Changes are kept on this device.",
      tone: "warning",
      durationMs: 0,
    },
  },
  {
    label: "With action",
    toast: {
      title: "Request sent",
      description: "The hotel team will answer within two days.",
      tone: "info",
      action: { label: "View", onPress: () => undefined },
    },
  },
  { label: "Danger", toast: { title: "Could not save", tone: "danger" } },
];

function ToastDemo() {
  const toast = useToast();
  return (
    <Row gap={2} wrap>
      {DEMOS.map((demo) => (
        <Button
          key={demo.label}
          variant="secondary"
          size="sm"
          onPress={() => toast.show(demo.toast)}
        >
          {demo.label}
        </Button>
      ))}
    </Row>
  );
}

export const stories = defineStories({
  title: "Toast",
  stories: [{ name: "Show toasts", render: () => <ToastDemo /> }],
});
