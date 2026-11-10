import { View } from "react-native";

import { Icon, Text } from "@ampm/ui";

import { env } from "@/lib/env";

/** Whether this build is the demo/test environment (EXPO_PUBLIC_DEMO=true, set by the test deploy). */
export function isDemoEnvironment(): boolean {
  return env.EXPO_PUBLIC_DEMO === "true";
}

export interface DemoBannerProps {
  /** Override the env check (for tests); defaults to whether this is the demo build. */
  readonly show?: boolean;
}

/**
 * A persistent strip at the top of the app marking the demo/test environment (app.ampmverse.com):
 * the data is sample data, not real bookings. Shown only in a demo build (the test deploy sets
 * EXPO_PUBLIC_DEMO), so a real build never renders it. A static note, not a dismissible alert.
 *
 *   <DemoBanner />
 */
export function DemoBanner({ show = isDemoEnvironment() }: DemoBannerProps = {}) {
  if (!show) return null;
  return (
    <View
      accessible
      accessibilityLabel="Demo environment: sample data, not real bookings."
      className="flex-row items-center justify-center gap-2 border-b border-highlight/30 bg-highlight/16 px-4 py-2"
      testID="demo-banner"
    >
      <Icon name="info" tone="highlight" size="sm" />
      <Text variant="label" tone="primary" className="shrink text-center">
        Demo environment — sample data, not real bookings
      </Text>
    </View>
  );
}
