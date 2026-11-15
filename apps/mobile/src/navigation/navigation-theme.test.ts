import { DefaultTheme } from "expo-router";

import { colors } from "@ampm/tokens";

import appConfig from "../../app.json";
import { navigationTheme } from "./navigation-theme";

describe("navigationTheme", () => {
  it("paints the screens' container with the background it is given, never the light default", () => {
    const web = navigationTheme("dark", "transparent");
    expect(web.dark).toBe(true);
    expect(web.colors.background).toBe("transparent");
    expect(web.colors.background).not.toBe(DefaultTheme.colors.background);
    expect(navigationTheme("dark", colors.surface.dark).colors.background).toBe(
      colors.surface.dark,
    );
  });

  it("takes its ink and accent from the tokens", () => {
    const theme = navigationTheme("dark", colors.surface.dark);
    expect(theme.colors.text).toBe(colors.primary.dark);
    expect(theme.colors.primary).toBe(colors.brand.dark);
    expect(theme.colors.border).toBe(colors.subtle.dark);
  });
});

describe("route bundling (app.json)", () => {
  // Async routes load each screen on its first visit behind a Suspense fallback that renders nothing
  // in production, held for React's ~300 ms reveal throttle: a blank flash on every first navigation.
  it("keeps every route in the main bundle", () => {
    expect(appConfig.expo.plugins).toContainEqual(["expo-router", { asyncRoutes: false }]);
  });
});
