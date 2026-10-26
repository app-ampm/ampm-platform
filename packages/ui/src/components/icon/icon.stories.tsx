import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { Icon } from "./icon";
import { iconNames } from "./icon.registry";

export const stories = defineStories({
  title: "Icon",
  stories: [
    {
      name: "Sizes and tones",
      render: () => (
        <Row gap={3} wrap>
          <Icon name="check" size="sm" />
          <Icon name="check" size="md" />
          <Icon name="check" size="lg" />
          <Icon name="check" size="xl" />
          <Icon name="alert-triangle" tone="warning" />
          <Icon name="alert-circle" tone="danger" />
          <Icon name="check-circle" tone="success" />
          <Icon name="info" tone="info" />
          <Icon name="star" tone="brand" label="Favourite" />
        </Row>
      ),
    },
    {
      name: "All icons",
      render: () => (
        <Row gap={3} wrap>
          {iconNames.map((name) => (
            <Stack key={name} gap={1} align="center" className="w-16">
              <Icon name={name} tone="muted" />
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {name}
              </Text>
            </Stack>
          ))}
        </Row>
      ),
    },
  ],
});
