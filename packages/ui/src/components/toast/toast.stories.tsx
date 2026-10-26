import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Row } from "../layout";
import { useToast } from "./toast-provider";

function ToastDemo() {
  const toast = useToast();
  return (
    <Row gap={2} wrap>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => toast.show({ title: "Saved", tone: "success" })}
      >
        Success
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() =>
          toast.show({
            title: "You are offline",
            description: "Changes are kept on this device.",
            tone: "warning",
            durationMs: 0,
          })
        }
      >
        Sticky warning
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() =>
          toast.show({
            title: "Request sent",
            description: "The hotel team will answer within two days.",
            tone: "info",
            action: { label: "View", onPress: () => undefined },
          })
        }
      >
        With action
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => toast.show({ title: "Could not save", tone: "danger" })}
      >
        Danger
      </Button>
    </Row>
  );
}

export const stories = defineStories({
  title: "Toast",
  stories: [{ name: "Show toasts", render: () => <ToastDemo /> }],
});
