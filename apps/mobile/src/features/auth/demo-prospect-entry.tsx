import { View } from "react-native";

import { Button, Card, Icon, Row, Stack, Text, type CardTone } from "@ampm/ui";

export interface DemoProspectEntryProps {
  /** Enters the seeded demo prospect (P-7: demo hotels, indicative prices) via `/auth/dev-login/demo`. */
  readonly enterDemo: () => void;
  readonly demoPending: boolean;
  readonly demoErrorText: string | undefined;
  /** Glass on a phone, a flat tint inside the centred card and under D1's card. */
  readonly tone: CardTone;
}

/**
 * The demo prospect's way in, on a card of its own: what the demo is, then one tap. Secondary, since
 * the client card's action is the screen's one gold button.
 */
export function DemoProspectEntry({
  enterDemo,
  demoPending,
  demoErrorText,
  tone,
}: DemoProspectEntryProps) {
  return (
    <Card tone={tone} padding="md" testID="demo-entry">
      <Stack gap={4}>
        <Row gap={3} align="center">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-highlight/14">
            <Icon name="sparkles" size="md" tone="highlight" />
          </View>
          <Stack gap={1} className="flex-1">
            <Text variant="eyebrow">Demo prospect</Text>
            <Text variant="subheading">Explore AMPM as a guest</Text>
          </Stack>
        </Row>
        <Text variant="bodySmall" tone="body">
          Browse a curated set of hotels with indicative prices. No account or code needed.
        </Text>
        {demoErrorText ? (
          <Text variant="bodySmall" tone="brand" accessibilityRole="alert">
            {demoErrorText}
          </Text>
        ) : null}
        <Button
          fullWidth
          variant="secondary"
          iconEnd="arrow-right"
          loading={demoPending}
          onPress={enterDemo}
          testID="demo-sign-in"
        >
          Explore the demo
        </Button>
      </Stack>
    </Card>
  );
}
