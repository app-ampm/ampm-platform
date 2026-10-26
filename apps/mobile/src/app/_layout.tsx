import "../global.css";

import { Fraunces_400Regular, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from "@expo-google-fonts/source-sans-3";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { fontFaces } from "@ampm/tokens";
import { ThemeProvider, ToastProvider } from "@ampm/ui";

import { AppStack } from "@/navigation/app-stack";

SplashScreen.preventAutoHideAsync();

/** The faces the tokens name (packages/tokens/src/typography.ts), loaded under exactly those names. */
const FONTS = {
  [fontFaces.display]: Fraunces_400Regular,
  [fontFaces.displaySemibold]: Fraunces_600SemiBold,
  [fontFaces.sans]: SourceSans3_400Regular,
  [fontFaces.sansMedium]: SourceSans3_500Medium,
  [fontFaces.sansSemibold]: SourceSans3_600SemiBold,
  [fontFaces.sansBold]: SourceSans3_700Bold,
  [fontFaces.mono]: JetBrainsMono_400Regular,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppStack />
      </ToastProvider>
    </ThemeProvider>
  );
}
