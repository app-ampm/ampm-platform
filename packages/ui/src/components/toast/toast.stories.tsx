import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Row } from "../layout";
import { useToast } from "./toast-provider";
import type { ToastOptions } from "./toast.types";

interface Demo {
  readonly label: string;
  readonly toast: ToastOptions;
}

const TONES: readonly Demo[] = [
  { label: "Note", toast: { title: "Draft kept on this device", tone: "neutral" } },
  {
    label: "Info",
    toast: {
      title: "Request sent",
      description: "The hotel team will answer within two days.",
      tone: "info",
    },
  },
  { label: "Success", toast: { title: "Saved", tone: "success" } },
  {
    label: "Warning",
    toast: { title: "Two rooms are allocated twice", tone: "warning" },
  },
  { label: "Danger", toast: { title: "Could not save", tone: "danger" } },
];

const BEHAVIOURS: readonly Demo[] = [
  {
    label: "Sticky",
    toast: {
      title: "You are offline",
      description: "Changes are kept on this device.",
      tone: "info",
      durationMs: 0,
    },
  },
  {
    label: "With action",
    toast: {
      title: "Proposal shared",
      description: "Version 2 is with the client.",
      tone: "success",
      action: { label: "View", onPress: () => undefined },
    },
  },
];

function ToastDemo({ demos }: { demos: readonly Demo[] }) {
  const toast = useToast();
  return (
    <Row gap={2} wrap>
      {demos.map((demo) => (
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
  stories: [
    {
      name: "Tones",
      description:
        "Base glass; the icon carries the tone (peacock done, gold problems, pearl notes).",
      render: () => <ToastDemo demos={TONES} />,
    },
    { name: "Sticky and with action", render: () => <ToastDemo demos={BEHAVIOURS} /> },
  ],
});
