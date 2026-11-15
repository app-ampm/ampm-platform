import { DarkTheme, type Theme } from "expo-router";

import { colors } from "@ampm/tokens";
import type { ResolvedTheme } from "@ampm/ui";

/**
 * React Navigation's theme in Peacock Night. Without one the navigator falls back to its light
 * default, and every screen's container (React Navigation's `Background`) paints `rgb(242, 242, 242)`
 * under the screen: on the web it showed as a white flash whenever a screen had not drawn yet.
 * `background` is what that container paints: the midnight surface on native, `transparent` on the
 * web, where global.css paints the page midnight through the tokens' variables.
 *
 *   <ThemeProvider value={navigationTheme("dark", colors.surface.dark)}><Stack /></ThemeProvider>
 */
export function navigationTheme(scheme: ResolvedTheme, background: string): Theme {
  return {
    ...DarkTheme,
    colors: {
      primary: colors.brand[scheme],
      background,
      card: background,
      text: colors.primary[scheme],
      border: colors.subtle[scheme],
      notification: colors.brand[scheme],
    },
  };
}
