import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { StatusChip } from "./status-chip";

export const stories = defineStories({
  title: "StatusChip",
  stories: [
    {
      name: "Treatments",
      description: "Every chip carries a word; the treatment only underlines it.",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Verified 2 Nov" tone="success" dot />
          <StatusChip label="Indicative" tone="info" />
          <StatusChip label="Awaiting hotel" tone="warning" />
          <StatusChip label="Needs approval" tone="danger" />
          <StatusChip label="Stale · checked 3 Jun" tone="neutral" />
          <StatusChip label="Featured" tone="brand" />
        </Row>
      ),
    },
    {
      name: "With a dot",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Synced 18:02" tone="success" dot />
          <StatusChip label="Submitted" tone="info" dot />
          <StatusChip label="Due 15 Dec" tone="warning" dot />
          <StatusChip label="2 blocked" tone="danger" dot />
          <StatusChip label="Closed" tone="neutral" dot />
          <StatusChip label="Selected" tone="brand" dot />
        </Row>
      ),
    },
    {
      name: "With an icon",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Ready 10 / 10" tone="success" icon="check" />
          <StatusChip label="On request" tone="info" icon="info" />
          <StatusChip label="Awaiting confirmation" tone="warning" icon="clock" />
          <StatusChip label="Conflict" tone="danger" icon="alert-triangle" />
          <StatusChip label="Archived" tone="neutral" icon="lock" />
          <StatusChip label="5-star" tone="brand" icon="star" />
        </Row>
      ),
    },
    {
      name: "Small, for dense rows",
      render: () => (
        <Row gap={2} wrap>
          <StatusChip label="Active" size="sm" tone="success" />
          <StatusChip label="Submitted" size="sm" tone="info" />
          <StatusChip label="Possible duplicate" size="sm" tone="warning" />
          <StatusChip label="Overdue" size="sm" tone="danger" />
          <StatusChip label="Lost" size="sm" tone="neutral" />
          <StatusChip label="Demo requested" size="sm" tone="brand" />
        </Row>
      ),
    },
    {
      name: "In a row on glass",
      render: () => (
        <GlassPanel className="p-5">
          <Stack gap={3}>
            <Row justify="between" gap={3}>
              <Text variant="label">Raj Niwas Palace</Text>
              <StatusChip label="Proposal shared" tone="success" size="sm" />
            </Row>
            <Row justify="between" gap={3}>
              <Text variant="label">Bagh Mahal Retreat</Text>
              <StatusChip label="Awaiting hotel" tone="warning" size="sm" />
            </Row>
          </Stack>
        </GlassPanel>
      ),
    },
  ],
});
