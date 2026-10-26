import { Stack } from "expo-router";

/**
 * Web: the server cannot know the scheme, so no colour is decided in JavaScript here; the screen
 * container stays transparent and the page background comes from global.css through the tokens'
 * CSS variables, which switch with the `dark` class without a hydration mismatch.
 */
export function AppStack() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
    />
  );
}
