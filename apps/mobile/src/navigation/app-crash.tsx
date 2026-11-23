import { type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ErrorState, Screen, ThemeProvider } from "@ampm/ui";

import { logCrash } from "./crash-log";

/**
 * The root layout's boundary, behind the per-screen one (screen-crash.tsx): it catches a crash
 * outside every screen (the providers, the rail or top navigation, the demo banner). It replaces the
 * whole root layout, so it brings its own theme and status bar, and there is no navigator left to
 * lead anywhere: "Try again" draws the app afresh. Logged by name and message only.
 *
 *   export { AppCrash as ErrorBoundary } from "@/navigation/app-crash"; // app/_layout.tsx
 */
export function AppCrash({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => logCrash("app", error), [error]);
  return (
    <ThemeProvider initialPreference="dark">
      <StatusBar style="light" />
      <Screen testID="app-crash">
        <ErrorState onRetry={() => void retry()} />
      </Screen>
    </ThemeProvider>
  );
}
