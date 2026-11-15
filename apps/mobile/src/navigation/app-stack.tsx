import { Stack, ThemeProvider } from "expo-router";
import { useMemo } from "react";

import { colors } from "@ampm/tokens";
import { useTheme } from "@ampm/ui";

import { AppChrome } from "./app-chrome";
import { navigationTheme } from "./navigation-theme";

/**
 * Native: the screen container and the navigator's background take the surface colour of the current
 * scheme from the tokens, so a screen that has not drawn yet shows the midnight canvas, never the
 * navigator's light default; on a tablet the chrome (staff rail or client top navigation) sits around
 * the stack.
 */
export function AppStack() {
  const { resolved } = useTheme();
  const surface = colors.surface[resolved];
  const theme = useMemo(() => navigationTheme(resolved, surface), [resolved, surface]);
  return (
    <ThemeProvider value={theme}>
      <AppChrome>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: surface } }} />
      </AppChrome>
    </ThemeProvider>
  );
}
