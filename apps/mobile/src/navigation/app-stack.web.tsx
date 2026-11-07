import { Stack } from "expo-router";

import { AppChrome } from "./app-chrome";

/**
 * Web: the server cannot know the scheme, so no colour is decided in JavaScript here; the screen
 * container stays transparent and the page background comes from global.css through the tokens'
 * CSS variables, which switch with the `dark` class without a hydration mismatch. The chrome around
 * the stack (staff rail, client top navigation) is drawn with classes only, after hydration.
 */
export function AppStack() {
  return (
    <AppChrome>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
      />
    </AppChrome>
  );
}
