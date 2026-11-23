import { Stack, ThemeProvider } from "expo-router";
import { useMemo } from "react";

import { colors } from "@ampm/tokens";
import { useTheme } from "@ampm/ui";

import { AppChrome } from "./app-chrome";
import { navigationTheme } from "./navigation-theme";
import { ScreenCrash } from "./screen-crash";

/**
 * Native: the screen container and the navigator's background take the surface colour of the current
 * scheme from the tokens, so a screen that has not drawn yet shows the midnight canvas, never the
 * navigator's light default; on a tablet the chrome (staff rail or client top navigation) sits around
 * the stack. A screen that throws while drawing shows `ScreenCrash` in its place, inside the stack,
 * so the navigator and the chrome survive it (expo-router 58's per-screen boundary, D-160).
 */
export function AppStack() {
  const { resolved } = useTheme();
  const surface = colors.surface[resolved];
  const theme = useMemo(() => navigationTheme(resolved, surface), [resolved, surface]);
  return (
    <ThemeProvider value={theme}>
      <AppChrome>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: surface } }}
          unstable_screenErrorBoundary={ScreenCrash}
        />
      </AppChrome>
    </ThemeProvider>
  );
}
