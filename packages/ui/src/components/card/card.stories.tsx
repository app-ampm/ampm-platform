import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { StatusChip } from "../status-chip";
import { Text } from "../text";
import { Card } from "./card";

export const stories = defineStories({
  title: "Card",
  stories: [
    {
      name: "Glass (default)",
      render: () => (
        <Card>
          <Stack gap={1}>
            <Text variant="eyebrow">Udaipur · Lake Pichola</Text>
            <Text variant="heading">Raj Niwas Palace</Text>
            <Text variant="bodySmall">420 guests · 80 rooms · 4 venues</Text>
          </Stack>
        </Card>
      ),
    },
    {
      name: "Peacock and gold",
      render: () => (
        <Stack gap={3}>
          <Card tone="peacock">
            <Stack gap={1}>
              <Text variant="eyebrow" tone="body">
                Hotel discovery
              </Text>
              <Text variant="heading">18 days left</Text>
            </Stack>
          </Card>
          <Card tone="gold">
            <Stack gap={1}>
              <Text variant="label">Chat with AMPM</Text>
              <Text variant="bodySmall">Quick questions, quick answers</Text>
            </Stack>
          </Card>
        </Stack>
      ),
    },
    {
      name: "Flat cards nested in a panel",
      render: () => (
        <Card padding="sm">
          <Stack gap={2}>
            <Text variant="label">My selection</Text>
            <Card tone="flat" padding="sm">
              <Text variant="label">Raj Niwas Palace</Text>
            </Card>
            <Card tone="flat" padding="sm">
              <Text variant="label">Bagh Mahal Retreat</Text>
            </Card>
          </Stack>
        </Card>
      ),
    },
    {
      name: "Internal (staff screens only)",
      render: () => (
        <Card tone="internal" padding="sm">
          <Text variant="bodySmall">
            GM is away until Monday; a rack-rate discount is possible.
          </Text>
        </Card>
      ),
    },
    {
      name: "Padding sm, md, lg",
      render: () => (
        <Row gap={2} align="start">
          {(["sm", "md", "lg"] as const).map((padding) => (
            <Card key={padding} padding={padding} className="flex-1">
              <Text variant="data">{padding}</Text>
            </Card>
          ))}
        </Row>
      ),
    },
    {
      name: "Pressable: hover, pressed, focus",
      render: () => (
        <Stack gap={3}>
          <Card onPress={() => undefined} accessibilityLabel="Open the Raj Niwas Palace record">
            <Stack gap={2}>
              <Text variant="heading">Raj Niwas Palace</Text>
              <StatusChip label="Verified" tone="success" icon="check" />
            </Stack>
          </Card>
          <Card tone="flat" padding="sm" onPress={() => undefined}>
            <Text variant="label">Aravalli Lake Resort</Text>
          </Card>
        </Stack>
      ),
    },
    {
      name: "Nested glass without a second blur",
      render: () => (
        <Card padding="sm">
          <Card blur={false} padding="sm">
            <Text variant="label">A glass card inside a panel</Text>
          </Card>
        </Card>
      ),
    },
  ],
});
