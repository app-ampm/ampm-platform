import { defineStories } from "../../stories/define";
import { Row } from "../layout";
import { StatusChip } from "./status-chip";

export const stories = defineStories({
  title: "StatusChip",
  stories: [
    {
      name: "Tones",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Draft" />
          <StatusChip label="Indicative" tone="info" />
          <StatusChip label="Verified" tone="success" icon="check" />
          <StatusChip label="Awaiting confirmation" tone="warning" icon="clock" />
          <StatusChip label="Conflict" tone="danger" icon="alert-triangle" />
          <StatusChip label="Demo" tone="brand" />
        </Row>
      ),
    },
    {
      name: "Small",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Pending" size="sm" tone="warning" />
          <StatusChip label="Synced" size="sm" tone="success" icon="check" />
        </Row>
      ),
    },
  ],
});
