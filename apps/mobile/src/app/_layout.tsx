import "../global.css";

import { ThemeProvider as NavigationThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { ThemeProvider, useTheme } from "@ampm/ui";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { resolved } = useTheme();
  return (
    <NavigationThemeProvider value={resolved === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}
