import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useTheme } from "@ampm/ui";

/**
 * Bootstrap check screen: a View and a Text with token classes only. It must look the same on web
 * and native, light and dark. Replaced by the real home screen in sprint 2.
 */
export default function TokensCheckScreen() {
  const { resolved, toggle } = useTheme();
  // The web build is server-rendered; the server cannot know the device scheme, so text that names it
  // appears only after hydration (otherwise React reports a hydration mismatch).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const schemeName = hydrated ? resolved : "system";
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-6"
      testID="tokens-screen"
    >
      <View
        className="gap-2 rounded-lg border border-subtle bg-surface-elevated p-4 shadow-sm"
        testID="tokens-card"
      >
        <Text className="text-lg font-semibold text-primary" testID="tokens-title">
          AMPM tokens
        </Text>
        <Text className="text-base text-muted" testID="tokens-body">
          Surface, text, border and brand colours from @ampm/tokens; {schemeName} scheme.
        </Text>
        <View className="flex-row flex-wrap gap-2 pt-2">
          <View className="rounded-full bg-success-soft px-3 py-1">
            <Text className="text-sm font-medium text-success">Verified</Text>
          </View>
          <View className="rounded-full bg-warning-soft px-3 py-1">
            <Text className="text-sm font-medium text-warning">Awaiting confirmation</Text>
          </View>
          <View className="rounded-full bg-danger-soft px-3 py-1">
            <Text className="text-sm font-medium text-danger">Conflict</Text>
          </View>
          <View className="rounded-full bg-info-soft px-3 py-1">
            <Text className="text-sm font-medium text-info">Indicative</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch colour scheme"
          className="mt-2 min-h-touch items-center justify-center rounded bg-brand px-4"
          onPress={toggle}
          testID="tokens-toggle"
        >
          <Text className="text-base font-semibold text-brand-ink">
            {hydrated ? `Switch to ${resolved === "dark" ? "light" : "dark"}` : "Switch scheme"}
          </Text>
        </Pressable>
      </View>
      <View className="rounded-lg bg-surface-inset p-4">
        <Text className="font-mono text-sm text-primary">
          bg-surface-inset · text-primary · font-mono
        </Text>
      </View>
    </ScrollView>
  );
}
