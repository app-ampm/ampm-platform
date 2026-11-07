import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { Avatar } from "./avatar";
import { AvatarGroup } from "./avatar-group";

const TEAM = [
  "Ritu Kapoor",
  "Isha Shah",
  "Meera Rao",
  "Dev Patel",
  "Sana Ali",
  "Om Joshi",
  "Tara Sen",
];

export const stories = defineStories({
  title: "Avatar",
  stories: [
    {
      name: "Sizes: 32, 40, 48, 56",
      render: () => (
        <Row gap={3} align="end">
          <Avatar name="Ananya Sharma" size="sm" />
          <Avatar name="Ananya Sharma" size="md" />
          <Avatar name="Ananya Sharma" size="lg" />
          <Avatar name="Ananya Sharma" size="xl" />
        </Row>
      ),
    },
    {
      name: "Tones: gold and peacock",
      render: () => (
        <Row gap={3}>
          <Avatar name="Kabir Mehta" tone="brand" />
          <Avatar name="Ananya Sharma" tone="highlight" />
          <Avatar name="Eva" tone="highlight" size="sm" />
        </Row>
      ),
    },
    {
      name: "In a row: family representatives",
      render: () => (
        <GlassPanel blur={false} className="rounded p-3">
          <Row gap={3}>
            <Avatar name="Ananya Sharma" tone="highlight" />
            <Stack gap={0} className="flex-1">
              <Text variant="label">Ananya Sharma</Text>
              <Text variant="caption">Bride&apos;s side · you</Text>
            </Stack>
          </Row>
        </GlassPanel>
      ),
    },
    {
      name: "Group",
      render: () => (
        <Stack gap={3}>
          <AvatarGroup names={["Ananya Sharma", "Kabir Mehta"]} />
          <AvatarGroup names={TEAM.slice(0, 4)} size="md" />
        </Stack>
      ),
    },
    {
      name: "Group past max: +n",
      render: () => (
        <Stack gap={3}>
          <AvatarGroup names={TEAM} max={2} />
          <AvatarGroup names={TEAM} max={3} size="lg" />
        </Stack>
      ),
    },
  ],
});
