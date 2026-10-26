import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { Row, Stack } from "../components/layout";
import { StatusChip } from "../components/status-chip";
import { Text } from "../components/text";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useIsClient } from "../hooks/use-is-client";
import { allStories, type Story, type StoryModule } from "../stories";
import { useTheme } from "../theme/theme-provider";

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function StoryCell({ story }: { story: Story }) {
  return (
    <Card padding="md" className="flex-1 gap-3">
      <Text variant="caption" tone="muted">
        {story.name}
      </Text>
      {story.render()}
    </Card>
  );
}

function Section({ module, columns }: { module: StoryModule; columns: number }) {
  return (
    <Stack gap={3}>
      <Text variant="heading">{module.title}</Text>
      {chunk(module.stories, columns).map((row, index) => (
        <Row key={index} gap={3} align="start">
          {row.map((story) => (
            <StoryCell key={story.name} story={story} />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }, (_, i) => (
                <View key={`pad-${i}`} className="flex-1" />
              ))
            : null}
        </Row>
      ))}
    </Stack>
  );
}

/**
 * Every component in every variant and state, on phone, tablet and web (standards §2.7 step 4).
 * One column on a phone, two on a tablet, three on a desktop window; the header switches the scheme.
 */
export function Gallery() {
  const { resolved, toggle } = useTheme();
  const { breakpoint, width, isPhone, isTablet } = useBreakpoint();
  const insets = useSafeAreaInsets();
  // The server knows no window: it renders the phone layout and the client takes over after hydration.
  const isClient = useIsClient();
  const columns = !isClient || isPhone ? 1 : isTablet ? 2 : 3;
  const sizeLabel = isClient ? `${breakpoint} · ${Math.round(width)} px` : "…";
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-8 p-4 pb-12 md:p-8"
      style={{ paddingTop: insets.top }}
      testID="gallery"
    >
      <Row justify="between" wrap gap={3}>
        <Stack gap={1}>
          <Text variant="title">AMPM UI</Text>
          <Row gap={2}>
            <StatusChip label={sizeLabel} tone="brand" size="sm" />
            <StatusChip label={resolved} size="sm" icon={resolved === "dark" ? "moon" : "sun"} />
          </Row>
        </Stack>
        <Button
          variant="secondary"
          size="sm"
          icon={resolved === "dark" ? "sun" : "moon"}
          onPress={toggle}
        >
          {resolved === "dark" ? "Light" : "Dark"}
        </Button>
      </Row>
      {allStories.map((module) => (
        <Section key={module.title} module={module} columns={columns} />
      ))}
    </ScrollView>
  );
}
