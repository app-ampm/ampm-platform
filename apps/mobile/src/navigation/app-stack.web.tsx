import { Stack, ThemeProvider } from "expo-router";

import { AppChrome } from "./app-chrome";
import { navigationTheme } from "./navigation-theme";
import { ScreenCrash } from "./screen-crash";

/**
 * The navigator's own background stays transparent on the web, so nothing it draws can show through
 * as a light flash while a screen mounts. Peacock Night's two schemes hold the same values, so the
 * remaining theme colours are the same whichever one is read before hydration.
 */
const WEB_THEME = navigationTheme("dark", "transparent");

/**
 * Web: the server cannot know the scheme, so no colour is decided in JavaScript here; the screen
 * container and the navigator's background stay transparent and the page background comes from
 * global.css through the tokens' CSS variables, which switch with the `dark` class without a
 * hydration mismatch. The chrome around the stack (staff rail, client top navigation) is drawn with
 * classes only, after hydration. A screen that throws while drawing shows `ScreenCrash` in its place,
 * as on native (D-160).
 */
export function AppStack() {
  return (
    <ThemeProvider value={WEB_THEME}>
      <AppChrome>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}
          unstable_screenErrorBoundary={ScreenCrash}
        />
      </AppChrome>
    </ThemeProvider>
  );
}
