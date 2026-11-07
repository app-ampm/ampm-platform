import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Text } from "../text";
import { GlowBackdrop } from "./glow-backdrop";
import type { GlowVariant } from "./glow-backdrop.styles";

function Sky({
  variant,
  eyebrow,
  title,
}: {
  variant: GlowVariant;
  eyebrow: string;
  title: string;
}) {
  return (
    <View className="h-64 overflow-hidden rounded-2xl border border-primary/16 bg-surface">
      <GlowBackdrop variant={variant} />
      <Stack gap={1} className="p-5">
        <Text variant="eyebrow">{eyebrow}</Text>
        <Text variant="heading">{title}</Text>
      </Stack>
    </View>
  );
}

export const stories = defineStories({
  title: "GlowBackdrop",
  stories: [
    {
      name: "Corners (default)",
      description: "Peacock behind the title, gold low in the far corner: every app screen.",
      render: () => <Sky variant="corners" eyebrow="Hotel discovery" title="Find your venue" />,
    },
    {
      name: "Top: hero layouts",
      render: () => <Sky variant="top" eyebrow="AMPM" title="Weddings, planned end to end." />,
    },
    {
      name: "Center: confirmations",
      render: () => <Sky variant="center" eyebrow="Request received" title="We will call you." />,
    },
    {
      name: "None",
      render: () => <Sky variant="none" eyebrow="Plain canvas" title="Midnight only" />,
    },
  ],
});
