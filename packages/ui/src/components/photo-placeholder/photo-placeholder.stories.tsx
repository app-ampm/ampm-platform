import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { PhotoPlaceholder } from "./photo-placeholder";

export const stories = defineStories({
  title: "PhotoPlaceholder",
  stories: [
    {
      name: "Gold, peacock, midnight",
      render: () => (
        <Stack gap={3}>
          <PhotoPlaceholder label="Palace photo · Lake Pichola" className="h-40 w-full" />
          <Row gap={3}>
            <PhotoPlaceholder label="Lake view" tone="peacock" className="h-28 flex-1" />
            <PhotoPlaceholder label="Map · Udaipur" tone="midnight" className="h-28 flex-1" />
          </Row>
        </Stack>
      ),
    },
    {
      name: "Hero, desktop radius",
      render: () => (
        <PhotoPlaceholder
          label="Hero · lake facade"
          className="aspect-video w-full rounded-2xl md:rounded-xl"
        />
      ),
    },
    {
      name: "In a card: photo above the title",
      render: () => (
        <Stack gap={2.5}>
          <PhotoPlaceholder label="Décor render" className="h-32 w-full rounded" />
          <Text variant="heading">Raj Niwas Palace</Text>
          <Text variant="bodySmall">Udaipur · Lake Pichola</Text>
        </Stack>
      ),
    },
    {
      name: "Thumbnails without a caption",
      render: () => (
        <Row gap={3}>
          <PhotoPlaceholder
            label="Raj Niwas Palace"
            showLabel={false}
            className="h-10 w-12 rounded-sm"
          />
          <PhotoPlaceholder
            label="Bagh Mahal Retreat"
            tone="peacock"
            showLabel={false}
            className="h-10 w-12 rounded-sm"
          />
          <PhotoPlaceholder
            label="Aravalli Lake Resort"
            showLabel={false}
            className="h-14 w-14 rounded-full"
          />
        </Row>
      ),
    },
  ],
});
