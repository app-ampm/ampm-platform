import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "../text";
import { GlassPanel } from "./glass-panel";

export const stories = defineStories({
  title: "Glass",
  stories: [
    {
      name: "Base: cards, panels, nav",
      render: () => (
        <GlassPanel className="p-5">
          <Stack gap={1}>
            <Text variant="eyebrow">Total discovery</Text>
            <Text variant="heading">Find your venue</Text>
            <Text>Midnight 50%, pearl 16% stroke, pearl 12% rim.</Text>
          </Stack>
        </GlassPanel>
      ),
    },
    {
      name: "Peacock: selected, verified, offline",
      render: () => (
        <GlassPanel recipe="peacock" className="p-5">
          <Stack gap={1}>
            <Text variant="eyebrow" tone="body">
              Offline-safe
            </Text>
            <Text variant="heading">Peacock glass</Text>
            <Text>Peacock 30%, peacock 70% stroke, pearl 20% rim.</Text>
          </Stack>
        </GlassPanel>
      ),
    },
    {
      name: "Gold: live, needs-you",
      render: () => (
        <GlassPanel recipe="gold" className="p-5">
          <Stack gap={1}>
            <Text variant="eyebrow" tone="body">
              Needs you
            </Text>
            <Text variant="heading">Gold glass</Text>
            <Text>Gold 14%, gold 50% stroke, gold 35% rim.</Text>
          </Stack>
        </GlassPanel>
      ),
    },
    {
      name: "Nested: flat, no second blur",
      render: () => (
        <GlassPanel className="p-4">
          <GlassPanel blur={false} className="rounded p-3">
            <Text variant="label">A row inside a panel</Text>
          </GlassPanel>
        </GlassPanel>
      ),
    },
  ],
});
