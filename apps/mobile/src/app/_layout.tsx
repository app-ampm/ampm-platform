import "../global.css";

import { GildaDisplay_400Regular } from "@expo-google-fonts/gilda-display";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { RozhaOne_400Regular } from "@expo-google-fonts/rozha-one";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ApiProvider } from "@ampm/api-client";
import { fontFaces } from "@ampm/tokens";
import { ThemeProvider, ToastProvider } from "@ampm/ui";

import { configureAmplify } from "@/lib/amplify";
import { env } from "@/lib/env";
import { getAccessToken, initAuthSession } from "@/lib/session";
import { AppStack } from "@/navigation/app-stack";

SplashScreen.preventAutoHideAsync();

// Configure Cognito once and seed/track the signed-in state before anything reads the session.
configureAmplify();
initAuthSession();

/** Peacock Night's faces as the tokens name them (packages/tokens/src/typography.ts), loaded under exactly those names. */
const FONTS = {
  [fontFaces.display]: GildaDisplay_400Regular,
  [fontFaces.sans]: Manrope_400Regular,
  [fontFaces.sansMedium]: Manrope_500Medium,
  [fontFaces.sansSemibold]: Manrope_600SemiBold,
  [fontFaces.sansBold]: Manrope_700Bold,
  [fontFaces.sansExtrabold]: Manrope_800ExtraBold,
  [fontFaces.devanagari]: RozhaOne_400Regular,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ApiProvider baseUrl={env.EXPO_PUBLIC_API_URL} getAccessToken={getAccessToken}>
      {/* Peacock Night is dark only: light status-bar content over the midnight canvas. */}
      <ThemeProvider initialPreference="dark">
        <StatusBar style="light" />
        <ToastProvider>
          <AppStack />
        </ToastProvider>
      </ThemeProvider>
    </ApiProvider>
  );
}
