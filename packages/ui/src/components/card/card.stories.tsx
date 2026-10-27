import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { StatusChip } from "../status-chip";
import { Text } from "../text";
import { Card } from "./card";

export const stories = defineStories({
  title: "Card",
  stories: [
    {
      name: "Static and elevated",
      render: () => (
        <Stack gap={3}>
          <Card>
            <Text variant="subheading">Taj Lake Palace</Text>
            <Text tone="muted">Udaipur · 83 rooms</Text>
          </Card>
          <Card elevated padding="lg">
            <Text variant="subheading">Elevated, large padding</Text>
          </Card>
        </Stack>
      ),
    },
    {
      name: "Pressable",
      render: () => (
        <Card onPress={() => undefined} accessibilityLabel="Open the Oberoi Udaivilas record">
          <Stack gap={2}>
            <Text variant="subheading">The Oberoi Udaivilas</Text>
            <StatusChip label="Verified" tone="success" icon="check" />
          </Stack>
        </Card>
      ),
    },
  ],
});
