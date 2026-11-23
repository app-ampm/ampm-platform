import { useCanGoBack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { Button, ErrorState, Screen, ScreenHeader } from "@ampm/ui";

import { logCrash } from "./crash-log";

/** The crash screen's words, kept together until the app's i18n replaces them. */
export const CRASH_COPY = {
  title: "Something went wrong",
  stateTitle: "This page stopped working",
  description: "Try again, or go to your home. If it keeps happening, tell the AMPM team.",
  home: "Go to home",
} as const;

/**
 * What a screen shows in its place when it throws while drawing (the stack's per-screen boundary,
 * app-stack.tsx), instead of a blank page. Only that screen is replaced: the providers, the rail or
 * top navigation and every other screen keep working, so Back, "Go to home" (the entry route, which
 * opens the person's own home) and the navigation all still lead somewhere. "Try again" draws the
 * screen afresh, which clears a passing failure. The crash is logged by name and message only.
 *
 *   <Stack unstable_screenErrorBoundary={ScreenCrash} />
 */
export function ScreenCrash({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  useEffect(() => logCrash("screen", error), [error]);
  const header = (
    <ScreenHeader
      title={CRASH_COPY.title}
      onBack={canGoBack ? () => router.back() : undefined}
      actions={
        <Button variant="secondary" size="sm" onPress={() => router.replace("/")}>
          {CRASH_COPY.home}
        </Button>
      }
    />
  );
  return (
    <Screen header={header} testID="screen-crash">
      <ErrorState
        title={CRASH_COPY.stateTitle}
        description={CRASH_COPY.description}
        onRetry={() => void retry()}
      />
    </Screen>
  );
}
