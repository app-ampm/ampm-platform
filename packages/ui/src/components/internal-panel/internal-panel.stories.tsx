import { defineStories } from "../../stories/define";
import { SAMPLE_AMOUNTS } from "../../stories/fixtures/sample-amounts";
import { Divider, Row, Stack } from "../layout";
import { Text } from "../text";
import { InternalPanel } from "./internal-panel";

// Staff-screen samples (T5 rate card, T6 enquiries). A client screen never renders this panel.
const COSTS = [
  { line: "Deluxe lake-view room", cost: SAMPLE_AMOUNTS.roomNight, margin: "22%" },
  { line: "Veg menu, per plate", cost: SAMPLE_AMOUNTS.vegPlate, margin: "18%" },
  { line: "Lawn hire, per function", cost: SAMPLE_AMOUNTS.lawnHire, margin: "14%" },
];

export const stories = defineStories({
  title: "InternalPanel",
  stories: [
    {
      name: "Cost and margin (T5)",
      render: () => (
        <InternalPanel>
          <Stack gap={0}>
            {COSTS.map((row, index) => (
              <Stack key={row.line} gap={0}>
                {index > 0 ? <Divider /> : null}
                <Row justify="between" gap={3} className="py-2">
                  <Text variant="bodySmall" tone="primary" className="flex-1">
                    {row.line}
                  </Text>
                  <Text variant="data">{row.cost}</Text>
                  <Text variant="data" tone="brand">
                    {row.margin}
                  </Text>
                </Row>
              </Stack>
            ))}
          </Stack>
          <Text variant="caption">Visible to Super Admin, Finance and the Hotel team</Text>
        </InternalPanel>
      ),
    },
    {
      name: "Internal note (T6)",
      render: () => (
        <InternalPanel label="Internal · Meera, 5 Nov 16:40">
          <Text variant="bodySmall">
            GM is away until Monday. Sales manager says a 15% rack-rate discount is possible if we
            confirm 60 rooms.
          </Text>
        </InternalPanel>
      ),
    },
  ],
});
